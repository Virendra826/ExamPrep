import { prisma } from '../../config/prisma.js';
import { AttemptStatus, TimerMode } from '@prisma/client';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../utils/errors.js';
import { evaluationService } from './evaluation.service.js';
import {
  calculateElapsedSeconds,
  calculateTimeRemainingSeconds,
  isAttemptTimedOut,
} from './timer.util.js';

export class AttemptService {
  async checkAndApplyTimeout(attempt: {
    id: string;
    status: AttemptStatus;
    started_at: Date | null;
    created_at: Date;
    quiz: {
      timer_mode: TimerMode;
      timer_duration_seconds: number | null;
    };
  }): Promise<{ timedOut: boolean; status: AttemptStatus }> {
    if (
      attempt.status === AttemptStatus.IN_PROGRESS &&
      attempt.quiz.timer_mode === TimerMode.FIXED &&
      attempt.quiz.timer_duration_seconds != null &&
      attempt.started_at != null
    ) {
      if (isAttemptTimedOut(attempt.started_at, attempt.quiz.timer_duration_seconds)) {
        const now = new Date();
        await prisma.$transaction(async (tx) => {
          await tx.quizAttempt.update({
            where: { id: attempt.id },
            data: {
              status: AttemptStatus.TIMEOUT,
              submitted_at: now,
              time_taken_seconds: attempt.quiz.timer_duration_seconds,
            },
          });
          await evaluationService.evaluateAttempt(attempt.id, tx);
        });
        return { timedOut: true, status: AttemptStatus.EVALUATED };
      }
    }
    return { timedOut: false, status: attempt.status };
  }

  async timeoutAttempt(attemptId: string, userId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: { timer_mode: true, timer_duration_seconds: true },
        },
      },
    });

    if (!attempt || attempt.user_id !== userId) {
      throw new NotFoundError('Attempt not found');
    }

    if (
      attempt.status === AttemptStatus.TIMEOUT ||
      attempt.status === AttemptStatus.SUBMITTED ||
      attempt.status === AttemptStatus.EVALUATED
    ) {
      return {
        attemptId: attempt.id,
        status: attempt.status,
        submitted_at: attempt.submitted_at,
        time_taken_seconds: attempt.time_taken_seconds,
      };
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ConflictError(`Attempt cannot be timed out from status: ${attempt.status}`);
    }

    if (attempt.quiz.timer_mode !== TimerMode.FIXED || !attempt.quiz.timer_duration_seconds) {
      throw new ConflictError('Cannot timeout a variable timer quiz');
    }

    if (!attempt.started_at || !isAttemptTimedOut(attempt.started_at, attempt.quiz.timer_duration_seconds)) {
      throw new ConflictError('Attempt has not yet expired');
    }

    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.TIMEOUT,
          submitted_at: now,
          time_taken_seconds: attempt.quiz.timer_duration_seconds,
        },
      });

      await evaluationService.evaluateAttempt(attemptId, tx);

      return {
        attemptId: updated.id,
        status: AttemptStatus.EVALUATED,
        submitted_at: updated.submitted_at,
        time_taken_seconds: updated.time_taken_seconds,
      };
    });

    return result;
  }

  async startAttempt(attemptId: string, userId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt || attempt.user_id !== userId) {
      throw new NotFoundError('Attempt not found');
    }

    if (attempt.status === AttemptStatus.IN_PROGRESS || attempt.status === AttemptStatus.STARTED) {
      throw new ConflictError('Attempt is already started');
    }

    if (
      attempt.status === AttemptStatus.SUBMITTED ||
      attempt.status === AttemptStatus.EVALUATED ||
      attempt.status === AttemptStatus.TIMEOUT
    ) {
      throw new ConflictError('Attempt is already submitted');
    }

    if (attempt.status !== AttemptStatus.CREATED) {
      throw new ConflictError(`Attempt cannot be started from status: ${attempt.status}`);
    }

    const updated = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: AttemptStatus.IN_PROGRESS,
        started_at: new Date(),
      },
    });

    return {
      attemptId: updated.id,
      status: updated.status,
      started_at: updated.started_at,
    };
  }

  async getAttemptById(attemptId: string, userId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            subject: { select: { id: true, name: true } },
            chapter: { select: { id: true, name: true } },
            quiz_questions: {
              orderBy: { display_order: 'asc' },
              include: {
                question: {
                  select: {
                    id: true,
                    question_text: true,
                    options: true,
                    question_type: true,
                    difficulty: true,
                    exam_name: true,
                    exam_year: true,
                    // correct_answer and explanation are strictly EXCLUDED
                  },
                },
              },
            },
          },
        },
        submitted_answers: {
          select: {
            id: true,
            quiz_question_id: true,
            selected_option: true,
            answered_at: true,
          },
        },
      },
    });

    if (!attempt || attempt.user_id !== userId) {
      throw new NotFoundError('Attempt not found');
    }

    // Auto-timeout check
    const timeoutCheck = await this.checkAndApplyTimeout({
      id: attempt.id,
      status: attempt.status,
      started_at: attempt.started_at,
      created_at: attempt.created_at,
      quiz: attempt.quiz,
    });
    const currentStatus = timeoutCheck.status;

    let serverTimeRemainingSeconds: number | null = null;
    let serverElapsedSeconds: number | null = null;

    if (attempt.quiz.timer_mode === TimerMode.FIXED && attempt.quiz.timer_duration_seconds != null) {
      serverTimeRemainingSeconds = attempt.started_at
        ? calculateTimeRemainingSeconds(attempt.started_at, attempt.quiz.timer_duration_seconds)
        : attempt.quiz.timer_duration_seconds;
    } else {
      serverElapsedSeconds = attempt.started_at
        ? calculateElapsedSeconds(attempt.started_at)
        : 0;
    }

    return {
      attempt: {
        id: attempt.id,
        status: currentStatus,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        time_taken_seconds: attempt.time_taken_seconds,
        created_at: attempt.created_at,
      },
      quiz: {
        id: attempt.quiz.id,
        subject: attempt.quiz.subject,
        chapter: attempt.quiz.chapter,
        question_type_filter: attempt.quiz.question_type_filter,
        requested_count: attempt.quiz.requested_count,
        order_mode: attempt.quiz.order_mode,
        timer_mode: attempt.quiz.timer_mode,
        timer_duration_seconds: attempt.quiz.timer_duration_seconds,
      },
      questions: attempt.quiz.quiz_questions.map((qq) => ({
        quiz_question_id: qq.id,
        display_order: qq.display_order,
        question_id: qq.question.id,
        question_text: qq.question.question_text,
        options: qq.question.options,
        question_type: qq.question.question_type,
        difficulty: qq.question.difficulty,
        exam_name: qq.question.exam_name,
        exam_year: qq.question.exam_year,
      })),
      submitted_answers: attempt.submitted_answers,
      serverTimeRemainingSeconds,
      serverElapsedSeconds,
    };
  }

  async saveAnswer(
    attemptId: string,
    quizQuestionId: string,
    selectedOption: string | null | undefined,
    userId: string
  ) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: { id: true, timer_mode: true, timer_duration_seconds: true },
        },
      },
    });

    if (!attempt || attempt.user_id !== userId) {
      throw new NotFoundError('Attempt not found');
    }

    // Auto-check timeout before processing answer
    const timeoutCheck = await this.checkAndApplyTimeout({
      id: attempt.id,
      status: attempt.status,
      started_at: attempt.started_at,
      created_at: attempt.created_at,
      quiz: attempt.quiz,
    });

    if (timeoutCheck.timedOut || timeoutCheck.status !== AttemptStatus.IN_PROGRESS) {
      throw new ConflictError('Cannot save answer: attempt is not in progress');
    }

    const quizQuestion = await prisma.quizQuestion.findFirst({
      where: {
        id: quizQuestionId,
        quiz_id: attempt.quiz_id,
      },
    });

    if (!quizQuestion) {
      throw new ValidationError("Quiz question does not belong to this attempt's quiz");
    }

    const answer = await prisma.submittedAnswer.upsert({
      where: {
        attempt_id_quiz_question_id: {
          attempt_id: attemptId,
          quiz_question_id: quizQuestionId,
        },
      },
      create: {
        attempt_id: attemptId,
        quiz_question_id: quizQuestionId,
        selected_option: selectedOption ?? null,
        answered_at: new Date(),
      },
      update: {
        selected_option: selectedOption ?? null,
        answered_at: new Date(),
      },
    });

    return {
      id: answer.id,
      quiz_question_id: answer.quiz_question_id,
      selected_option: answer.selected_option,
      answered_at: answer.answered_at,
    };
  }

  async submitAttempt(attemptId: string, userId: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt || attempt.user_id !== userId) {
      throw new NotFoundError('Attempt not found');
    }

    // Idempotent: if already SUBMITTED or EVALUATED, return existing state
    if (attempt.status === AttemptStatus.SUBMITTED || attempt.status === AttemptStatus.EVALUATED) {
      return {
        attemptId: attempt.id,
        status: attempt.status,
        submitted_at: attempt.submitted_at,
        time_taken_seconds: attempt.time_taken_seconds,
      };
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new ConflictError(`Attempt cannot be submitted from status: ${attempt.status}`);
    }

    const now = new Date();
    const startTime = attempt.started_at ? attempt.started_at.getTime() : attempt.created_at.getTime();
    const timeTakenSeconds = Math.max(0, Math.floor((now.getTime() - startTime) / 1000));

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.SUBMITTED,
          submitted_at: now,
          time_taken_seconds: timeTakenSeconds,
        },
      });

      await evaluationService.evaluateAttempt(attemptId, tx);

      return {
        attemptId: updated.id,
        status: AttemptStatus.EVALUATED,
        submitted_at: updated.submitted_at,
        time_taken_seconds: updated.time_taken_seconds,
      };
    });

    return result;
  }

  async getAttemptHistory(userId: string, query: { page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const [attempts, total] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          quiz: {
            include: {
              subject: { select: { id: true, name: true } },
              chapter: { select: { id: true, name: true } },
            },
          },
          result: true,
        },
      }),
      prisma.quizAttempt.count({
        where: { user_id: userId },
      }),
    ]);

    const data = attempts.map((a) => ({
      id: a.id,
      quiz_id: a.quiz_id,
      quiz: {
        subject: a.quiz.subject,
        chapter: a.quiz.chapter,
        question_type_filter: a.quiz.question_type_filter,
        requested_count: a.quiz.requested_count,
        timer_mode: a.quiz.timer_mode,
        timer_duration_seconds: a.quiz.timer_duration_seconds,
      },
      status: a.status,
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      time_taken_seconds: a.time_taken_seconds,
      created_at: a.created_at,
      score: a.result?.marks_obtained ?? null,
      total_marks: a.result?.total_marks ?? null,
      percentage: a.result?.percentage ?? null,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getAttemptResult(attemptId: string, userId: string, userRole: string) {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        result: true,
        quiz: {
          include: {
            subject: { select: { id: true, name: true } },
            chapter: { select: { id: true, name: true } },
            quiz_questions: {
              orderBy: { display_order: 'asc' },
              include: {
                question: {
                  select: {
                    id: true,
                    question_text: true,
                    options: true,
                    question_type: true,
                    difficulty: true,
                    exam_name: true,
                    exam_year: true,
                    correct_answer: true,
                    explanation: true,
                  },
                },
              },
            },
          },
        },
        submitted_answers: true,
      },
    });

    if (!attempt) {
      throw new NotFoundError('Attempt not found');
    }

    if (attempt.user_id !== userId && userRole !== 'ADMIN') {
      throw new NotFoundError('Attempt not found');
    }

    if (attempt.status !== AttemptStatus.EVALUATED || !attempt.result) {
      throw new ConflictError('Attempt has not yet been evaluated');
    }

    const answerMap = new Map<string, { selected_option: string | null; is_correct: boolean | null }>();
    for (const ans of attempt.submitted_answers) {
      answerMap.set(ans.quiz_question_id, {
        selected_option: ans.selected_option,
        is_correct: ans.is_correct,
      });
    }

    const questionReview = attempt.quiz.quiz_questions.map((qq) => {
      const studentAnswer = answerMap.get(qq.id);
      return {
        quiz_question_id: qq.id,
        display_order: qq.display_order,
        question_id: qq.question.id,
        question_text: qq.question.question_text,
        options: qq.question.options,
        question_type: qq.question.question_type,
        difficulty: qq.question.difficulty,
        exam_name: qq.question.exam_name,
        exam_year: qq.question.exam_year,
        selected_option: studentAnswer?.selected_option ?? null,
        correct_answer: qq.question.correct_answer,
        is_correct: studentAnswer?.is_correct ?? false,
        explanation: qq.question.explanation,
      };
    });

    return {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        time_taken_seconds: attempt.time_taken_seconds,
        created_at: attempt.created_at,
      },
      quiz: {
        id: attempt.quiz.id,
        subject: attempt.quiz.subject,
        chapter: attempt.quiz.chapter,
        question_type_filter: attempt.quiz.question_type_filter,
        requested_count: attempt.quiz.requested_count,
      },
      result: attempt.result,
      questions: questionReview,
    };
  }
}

export const attemptService = new AttemptService();
