import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import {
  computeEvaluation,
  DEFAULT_SCORING_CONFIG,
} from '../src/modules/attempts/evaluation.service.js';

describe('Scoring & Evaluation Engine (PROMPT 21)', () => {
  describe('computeEvaluation Unit Tests', () => {
    it('handles all-correct answers accurately (100% score and 100% accuracy)', () => {
      const questions = [
        { quiz_question_id: 'qq-1', correct_answer: 'TCP' },
        { quiz_question_id: 'qq-2', correct_answer: 'SYN' },
        { quiz_question_id: 'qq-3', correct_answer: '80' },
      ];
      const answers = [
        { quiz_question_id: 'qq-1', selected_option: 'TCP' },
        { quiz_question_id: 'qq-2', selected_option: 'SYN' },
        { quiz_question_id: 'qq-3', selected_option: '80' },
      ];

      const res = computeEvaluation(questions, answers);
      expect(res.total_questions).toBe(3);
      expect(res.attempted_count).toBe(3);
      expect(res.correct_count).toBe(3);
      expect(res.incorrect_count).toBe(0);
      expect(res.unattempted_count).toBe(0);
      expect(res.marks_obtained).toBe(3);
      expect(res.total_marks).toBe(3);
      expect(res.percentage).toBe(100);
      expect(res.accuracy).toBe(100);
      expect(res.per_question_answers.every((a) => a.is_correct)).toBe(true);
    });

    it('handles all-incorrect answers accurately (0% score and 0% accuracy)', () => {
      const questions = [
        { quiz_question_id: 'qq-1', correct_answer: 'TCP' },
        { quiz_question_id: 'qq-2', correct_answer: 'SYN' },
      ];
      const answers = [
        { quiz_question_id: 'qq-1', selected_option: 'UDP' },
        { quiz_question_id: 'qq-2', selected_option: 'ACK' },
      ];

      const res = computeEvaluation(questions, answers);
      expect(res.total_questions).toBe(2);
      expect(res.attempted_count).toBe(2);
      expect(res.correct_count).toBe(0);
      expect(res.incorrect_count).toBe(2);
      expect(res.unattempted_count).toBe(0);
      expect(res.marks_obtained).toBe(0);
      expect(res.percentage).toBe(0);
      expect(res.accuracy).toBe(0);
    });

    it('handles all-unattempted answers without NaN in accuracy', () => {
      const questions = [
        { quiz_question_id: 'qq-1', correct_answer: 'TCP' },
        { quiz_question_id: 'qq-2', correct_answer: 'SYN' },
      ];
      const answers: Array<{ quiz_question_id: string; selected_option: string | null }> = [];

      const res = computeEvaluation(questions, answers);
      expect(res.total_questions).toBe(2);
      expect(res.attempted_count).toBe(0);
      expect(res.correct_count).toBe(0);
      expect(res.incorrect_count).toBe(0);
      expect(res.unattempted_count).toBe(2);
      expect(res.marks_obtained).toBe(0);
      expect(res.percentage).toBe(0);
      expect(res.accuracy).toBe(0); // Guard divide-by-zero: 0, not NaN
      expect(Number.isNaN(res.accuracy)).toBe(false);
    });

    it('handles mixed scenario (correct, incorrect, unattempted)', () => {
      const questions = [
        { quiz_question_id: 'qq-1', correct_answer: 'TCP' },
        { quiz_question_id: 'qq-2', correct_answer: 'SYN' },
        { quiz_question_id: 'qq-3', correct_answer: '80' },
        { quiz_question_id: 'qq-4', correct_answer: '443' },
      ];
      const answers = [
        { quiz_question_id: 'qq-1', selected_option: 'TCP' }, // Correct
        { quiz_question_id: 'qq-2', selected_option: 'ACK' }, // Incorrect
        { quiz_question_id: 'qq-3', selected_option: null }, // Unattempted
        // qq-4 not provided -> unattempted
      ];

      const res = computeEvaluation(questions, answers);
      expect(res.total_questions).toBe(4);
      expect(res.attempted_count).toBe(2);
      expect(res.correct_count).toBe(1);
      expect(res.incorrect_count).toBe(1);
      expect(res.unattempted_count).toBe(2);
      expect(res.marks_obtained).toBe(1);
      expect(res.total_marks).toBe(4);
      expect(res.percentage).toBe(25);
      expect(res.accuracy).toBe(50);
    });

    it('handles single-question edge case correctly', () => {
      const questions = [{ quiz_question_id: 'qq-1', correct_answer: 'True' }];
      const answers = [{ quiz_question_id: 'qq-1', selected_option: 'True' }];

      const res = computeEvaluation(questions, answers);
      expect(res.total_questions).toBe(1);
      expect(res.attempted_count).toBe(1);
      expect(res.correct_count).toBe(1);
      expect(res.marks_obtained).toBe(1);
      expect(res.total_marks).toBe(1);
      expect(res.percentage).toBe(100);
      expect(res.accuracy).toBe(100);
    });
  });

  describe('Supertest Integration: End-to-End Evaluation Persistence', () => {
    let studentCookies: string[] = [];
    let testSubjectId: string;
    let quizId: string;
    let attemptId: string;
    let createdQuizIds: string[] = [];
    let createdAttemptIds: string[] = [];

    beforeAll(async () => {
      // Login student
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'student@examprep.dev', password: 'StudentDev123!' });
      studentCookies = loginRes.headers['set-cookie'] as unknown as string[];

      // Pick active subject with known questions
      const subject = await prisma.subject.findFirst({
        where: { is_active: true, questions: { some: { status: 'ACTIVE' } } },
      });
      testSubjectId = subject!.id;

      // Create a quiz with 2 questions
      const quizRes = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          requested_count: 2,
          timer_mode: 'VARIABLE',
          order_mode: 'SEQUENTIAL',
        });

      quizId = quizRes.body.quizId;
      attemptId = quizRes.body.attemptId;
      createdQuizIds.push(quizId);
      createdAttemptIds.push(attemptId);

      // Start attempt
      await request(app)
        .post(`/api/v1/attempts/${attemptId}/start`)
        .set('Cookie', studentCookies);
    });

    afterAll(async () => {
      if (createdAttemptIds.length > 0) {
        await prisma.result.deleteMany({ where: { attempt_id: { in: createdAttemptIds } } }).catch(() => {});
        await prisma.submittedAnswer.deleteMany({ where: { attempt_id: { in: createdAttemptIds } } }).catch(() => {});
        await prisma.quizAttempt.deleteMany({ where: { id: { in: createdAttemptIds } } }).catch(() => {});
      }
      if (createdQuizIds.length > 0) {
        await prisma.quizQuestion.deleteMany({ where: { quiz_id: { in: createdQuizIds } } }).catch(() => {});
        await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } }).catch(() => {});
      }
      await prisma.$disconnect();
    });

    it('submitting an attempt computes evaluation, creates Result row, and transitions to EVALUATED', async () => {
      // Get questions and their actual correct answers from DB
      const quizQuestions = await prisma.quizQuestion.findMany({
        where: { quiz_id: quizId },
        include: { question: true },
        orderBy: { display_order: 'asc' },
      });

      expect(quizQuestions.length).toBe(2);

      // Answer question 1 CORRECTLY
      await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers/${quizQuestions[0].id}`)
        .set('Cookie', studentCookies)
        .send({ selected_option: quizQuestions[0].question.correct_answer });

      // Leave question 2 UNANSWERED

      // Submit attempt
      const submitRes = await request(app)
        .post(`/api/v1/attempts/${attemptId}/submit`)
        .set('Cookie', studentCookies);

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.status).toBe('EVALUATED');

      // Verify Result in database
      const result = await prisma.result.findUnique({
        where: { attempt_id: attemptId },
      });

      expect(result).not.toBeNull();
      expect(result!.total_questions).toBe(2);
      expect(result!.attempted_count).toBe(1);
      expect(result!.correct_count).toBe(1);
      expect(result!.incorrect_count).toBe(0);
      expect(result!.unattempted_count).toBe(1);
      expect(result!.marks_obtained).toBe(1);
      expect(result!.total_marks).toBe(2);
      expect(result!.percentage).toBe(50);
      expect(result!.accuracy).toBe(100);

      // Verify SubmittedAnswer row is_correct is frozen
      const answer1 = await prisma.submittedAnswer.findUnique({
        where: {
          attempt_id_quiz_question_id: {
            attempt_id: attemptId,
            quiz_question_id: quizQuestions[0].id,
          },
        },
      });
      expect(answer1!.is_correct).toBe(true);

      const answer2 = await prisma.submittedAnswer.findUnique({
        where: {
          attempt_id_quiz_question_id: {
            attempt_id: attemptId,
            quiz_question_id: quizQuestions[1].id,
          },
        },
      });
      expect(answer2!.is_correct).toBe(false);
      expect(answer2!.selected_option).toBeNull();
    });
  });
});
