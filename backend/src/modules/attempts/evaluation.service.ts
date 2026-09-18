import { prisma } from '../../config/prisma.js';
import { AttemptStatus, Prisma } from '@prisma/client';
import { NotFoundError } from '../../utils/errors.js';

/**
 * Configurable scoring rules [ENGINEERING DECISION: +1 mark per correct answer, 0 for incorrect/unattempted,
 * no negative marking in V1 — documented as a configurable constant, not hardcoded magic numbers,
 * so negative marking can be added later without a rewrite].
 */
export const DEFAULT_SCORING_CONFIG = {
  MARKS_PER_CORRECT: 1.0,
  MARKS_PER_INCORRECT: 0.0,
  MARKS_PER_UNATTEMPTED: 0.0,
} as const;

export interface EvaluationQuestionInput {
  quiz_question_id: string;
  correct_answer: string;
  options?: unknown;
}

export interface EvaluationAnswerInput {
  quiz_question_id: string;
  selected_option: string | null | undefined;
}

export interface EvaluationResultData {
  total_questions: number;
  attempted_count: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  accuracy: number;
  per_question_answers: Array<{
    quiz_question_id: string;
    selected_option: string | null;
    is_correct: boolean;
  }>;
}

/**
 * Robust option matching helper that supports:
 * - Matching by option ID (e.g. "A", "B", or UUID)
 * - Matching by option Text (e.g. "Foreign Key")
 * - Matching by 0-based letter index ("A", "B", "C", "D")
 */
export function isOptionMatch(
  selected: string | null | undefined,
  correctAnswer: string,
  options?: unknown
): boolean {
  if (!selected) return false;
  const sel = selected.trim();
  const corr = correctAnswer.trim();

  // Direct case-insensitive match
  if (sel.toLowerCase() === corr.toLowerCase()) {
    return true;
  }

  let optList = options;
  if (typeof optList === 'string') {
    try {
      optList = JSON.parse(optList);
    } catch {
      // ignore
    }
  }

  // If options array is available, cross-reference ID and text
  if (Array.isArray(optList)) {
    // 1. Identify which option represents the correct answer
    const correctOpt = optList.find((opt, idx) => {
      if (typeof opt === 'string') {
        const letter = String.fromCharCode(65 + idx);
        return opt.trim().toLowerCase() === corr.toLowerCase() || letter.toLowerCase() === corr.toLowerCase();
      }
      const optId = opt?.id ? String(opt.id).trim().toLowerCase() : '';
      const optText = opt?.text ? String(opt.text).trim().toLowerCase() : '';
      const letter = String.fromCharCode(65 + idx).toLowerCase();
      return optId === corr.toLowerCase() || optText === corr.toLowerCase() || letter === corr.toLowerCase();
    });

    if (correctOpt) {
      if (typeof correctOpt === 'string') {
        const optIndex = optList.indexOf(correctOpt);
        const letter = String.fromCharCode(65 + optIndex);
        return sel.toLowerCase() === correctOpt.trim().toLowerCase() || sel.toLowerCase() === letter.toLowerCase();
      }
      const optId = correctOpt?.id ? String(correctOpt.id).trim().toLowerCase() : '';
      const optText = correctOpt?.text ? String(correctOpt.text).trim().toLowerCase() : '';
      const optIndex = optList.indexOf(correctOpt);
      const letter = String.fromCharCode(65 + optIndex).toLowerCase();
      return (
        (optId !== '' && sel.toLowerCase() === optId) ||
        (optText !== '' && sel.toLowerCase() === optText) ||
        sel.toLowerCase() === letter
      );
    }
  }

  return false;
}

/**
 * Pure, deterministic evaluation calculation.
 * Critical for unit testing without database side effects.
 */
export function computeEvaluation(
  questions: EvaluationQuestionInput[],
  submittedAnswers: EvaluationAnswerInput[],
  scoringConfig = DEFAULT_SCORING_CONFIG
): EvaluationResultData {
  const answerMap = new Map<string, string | null>();
  for (const ans of submittedAnswers) {
    answerMap.set(ans.quiz_question_id, ans.selected_option ?? null);
  }

  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  const perQuestionAnswers: Array<{
    quiz_question_id: string;
    selected_option: string | null;
    is_correct: boolean;
  }> = [];

  for (const q of questions) {
    const selected = answerMap.get(q.quiz_question_id);
    const isAttempted = selected != null && selected.trim() !== '';

    if (!isAttempted) {
      unattemptedCount++;
      perQuestionAnswers.push({
        quiz_question_id: q.quiz_question_id,
        selected_option: null,
        is_correct: false,
      });
    } else {
      const isCorrect = isOptionMatch(selected, q.correct_answer, q.options);
      if (isCorrect) {
        correctCount++;
      } else {
        incorrectCount++;
      }
      perQuestionAnswers.push({
        quiz_question_id: q.quiz_question_id,
        selected_option: selected,
        is_correct: isCorrect,
      });
    }
  }

  const totalQuestions = questions.length;
  const attemptedCount = correctCount + incorrectCount;
  const marksObtained =
    correctCount * scoringConfig.MARKS_PER_CORRECT +
    incorrectCount * scoringConfig.MARKS_PER_INCORRECT +
    unattemptedCount * scoringConfig.MARKS_PER_UNATTEMPTED;
  const totalMarks = totalQuestions * scoringConfig.MARKS_PER_CORRECT;

  // Percentage = (marks / total_marks) * 100
  const percentage = totalMarks > 0 ? Number(((marksObtained / totalMarks) * 100).toFixed(2)) : 0;

  // Accuracy = (correct / attempted) * 100 [guard divide by zero: 0 attempted -> accuracy = 0, not NaN]
  const accuracy = attemptedCount > 0 ? Number(((correctCount / attemptedCount) * 100).toFixed(2)) : 0;

  return {
    total_questions: totalQuestions,
    attempted_count: attemptedCount,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unattempted_count: unattemptedCount,
    marks_obtained: marksObtained,
    total_marks: totalMarks,
    percentage,
    accuracy,
    per_question_answers: perQuestionAnswers,
  };
}

export class EvaluationService {
  /**
   * Evaluates a completed attempt:
   * 1. Evaluates each answer against correct_answer with option ID/text resolution.
   * 2. Freezes is_correct on SubmittedAnswer rows.
   * 3. Creates the Result record.
   * 4. Sets QuizAttempt.status = EVALUATED.
   */
  async evaluateAttempt(
    attemptId: string,
    existingTx?: Prisma.TransactionClient
  ) {
    const runInTx = async (tx: Prisma.TransactionClient) => {
      // 1. Check if Result already exists (idempotency)
      const existingResult = await tx.result.findUnique({
        where: { attempt_id: attemptId },
      });
      if (existingResult) {
        return existingResult;
      }

      // 2. Fetch attempt with quiz questions and questions
      const attempt = await tx.quizAttempt.findUnique({
        where: { id: attemptId },
        include: {
          quiz: {
            include: {
              quiz_questions: {
                orderBy: { display_order: 'asc' },
                include: {
                  question: {
                    select: {
                      id: true,
                      correct_answer: true,
                      options: true,
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

      // 3. Format inputs for pure computeEvaluation
      const questionsInput: EvaluationQuestionInput[] = attempt.quiz.quiz_questions.map((qq) => ({
        quiz_question_id: qq.id,
        correct_answer: qq.question.correct_answer,
        options: qq.question.options,
      }));

      const answersInput: EvaluationAnswerInput[] = attempt.submitted_answers.map((sa) => ({
        quiz_question_id: sa.quiz_question_id,
        selected_option: sa.selected_option,
      }));

      const evalData = computeEvaluation(questionsInput, answersInput);

      // 4. Freeze is_correct on SubmittedAnswer rows
      for (const item of evalData.per_question_answers) {
        const existingAns = attempt.submitted_answers.find(
          (sa) => sa.quiz_question_id === item.quiz_question_id
        );

        if (existingAns) {
          await tx.submittedAnswer.update({
            where: { id: existingAns.id },
            data: {
              is_correct: item.is_correct,
            },
          });
        } else {
          // If no row existed for this question (skipped entirely), create unattempted row
          await tx.submittedAnswer.create({
            data: {
              attempt_id: attempt.id,
              quiz_question_id: item.quiz_question_id,
              selected_option: null,
              is_correct: false,
              answered_at: new Date(),
            },
          });
        }
      }

      // 5. Create Result row
      const result = await tx.result.create({
        data: {
          attempt_id: attempt.id,
          total_questions: evalData.total_questions,
          attempted_count: evalData.attempted_count,
          correct_count: evalData.correct_count,
          incorrect_count: evalData.incorrect_count,
          unattempted_count: evalData.unattempted_count,
          marks_obtained: evalData.marks_obtained,
          total_marks: evalData.total_marks,
          percentage: evalData.percentage,
          accuracy: evalData.accuracy,
          time_taken_seconds: attempt.time_taken_seconds || 0,
        },
      });

      // 6. Update QuizAttempt status to EVALUATED
      await tx.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: AttemptStatus.EVALUATED,
        },
      });

      return result;
    };

    if (existingTx) {
      return runInTx(existingTx);
    } else {
      return prisma.$transaction(async (tx) => runInTx(tx));
    }
  }
}

export const evaluationService = new EvaluationService();
