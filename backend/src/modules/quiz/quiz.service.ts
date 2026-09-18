import { prisma } from '../../config/prisma.js';
import { questionSelectorService } from './questionSelector.service.js';
import { CreateQuizInput } from './quiz.validator.js';
import {
  NotFoundError,
  ForbiddenError,
  UnprocessableEntityError,
} from '../../utils/errors.js';
import { AttemptStatus } from '@prisma/client';

export class QuizService {
  private async verifyChapterSubject(chapterId: string, subjectId: string): Promise<void> {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { subject_id: true },
    });
    if (!chapter) {
      throw new NotFoundError('Chapter not found');
    }
    if (chapter.subject_id !== subjectId) {
      throw new UnprocessableEntityError('Chapter does not belong to the selected subject');
    }
  }

  async createQuiz(data: CreateQuizInput, userId: string) {
    // 1. Validate chapter belongs to subject if specified
    if (data.chapter_id) {
      await this.verifyChapterSubject(data.chapter_id, data.subject_id);
    }

    // 2. Select questions via QuestionSelector
    const selectedQuestions = await questionSelectorService.selectQuestions({
      subjectId: data.subject_id,
      chapterId: data.chapter_id,
      type: data.question_type_filter as 'CONCEPT' | 'PYQ' | 'BOTH',
      count: data.requested_count,
      order: data.order_mode as 'SEQUENTIAL' | 'RANDOM',
    });

    // 3. Atomically create Quiz, QuizQuestion snapshots, and initial QuizAttempt
    const result = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          created_by_user_id: userId,
          subject_id: data.subject_id,
          chapter_id: data.chapter_id || null,
          question_type_filter: data.question_type_filter,
          requested_count: data.requested_count,
          order_mode: data.order_mode,
          timer_mode: data.timer_mode,
          timer_duration_seconds: data.timer_duration_seconds || null,
        },
      });

      // Create frozen QuizQuestion snapshots
      await Promise.all(
        selectedQuestions.map((q, idx) =>
          tx.quizQuestion.create({
            data: {
              quiz_id: quiz.id,
              question_id: q.id,
              display_order: idx + 1,
            },
          })
        )
      );

      // Create initial QuizAttempt (status = CREATED)
      const attempt = await tx.quizAttempt.create({
        data: {
          quiz_id: quiz.id,
          user_id: userId,
          status: AttemptStatus.CREATED,
        },
      });

      return {
        quizId: quiz.id,
        attemptId: attempt.id,
      };
    });

    return result;
  }

  async getQuizById(quizId: string, userId: string, userRole: string) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        subject: { select: { id: true, name: true } },
        chapter: { select: { id: true, name: true } },
        _count: { select: { quiz_questions: true } },
      },
    });

    if (!quiz) {
      throw new NotFoundError('Quiz not found');
    }

    if (quiz.created_by_user_id !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to view this quiz');
    }

    return {
      id: quiz.id,
      subject: quiz.subject,
      chapter: quiz.chapter,
      question_type_filter: quiz.question_type_filter,
      requested_count: quiz.requested_count,
      actual_question_count: quiz._count.quiz_questions,
      order_mode: quiz.order_mode,
      timer_mode: quiz.timer_mode,
      timer_duration_seconds: quiz.timer_duration_seconds,
      created_at: quiz.created_at,
    };
  }
}

export const quizService = new QuizService();
