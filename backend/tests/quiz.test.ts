import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import {
  questionSelectorService,
  shuffleArray,
} from '../src/modules/quiz/questionSelector.service.js';

let studentCookies: string[] = [];
let testSubjectId: string;
let testChapterId: string;
let otherSubjectId: string;
let createdQuizIds: string[] = [];
let createdAttemptIds: string[] = [];

beforeAll(async () => {
  // Find two active subjects with chapters and questions
  const subjects = await prisma.subject.findMany({
    where: { is_active: true, chapters: { some: { is_active: true } } },
    include: { chapters: true },
    take: 2,
  });

  if (subjects.length < 2) {
    throw new Error('Seed data required: at least two active subjects with chapters');
  }

  testSubjectId = subjects[0].id;
  testChapterId = subjects[0].chapters[0].id;
  otherSubjectId = subjects[1].id;

  // Student login
  const studentRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'student@examprep.dev', password: 'StudentDev123!' });
  studentCookies = studentRes.headers['set-cookie'] as unknown as string[];
});

afterAll(async () => {
  if (createdAttemptIds.length > 0) {
    await prisma.submittedAnswer.deleteMany({ where: { attempt_id: { in: createdAttemptIds } } }).catch(() => {});
    await prisma.quizAttempt.deleteMany({ where: { id: { in: createdAttemptIds } } }).catch(() => {});
  }
  if (createdQuizIds.length > 0) {
    await prisma.quizQuestion.deleteMany({ where: { quiz_id: { in: createdQuizIds } } }).catch(() => {});
    await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('Quiz Generation Engine (PROMPT 17)', () => {
  describe('QuestionSelector Unit Tests', () => {
    it('shuffleArray helper should maintain all elements without loss or addition', () => {
      const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = shuffleArray(original);

      expect(shuffled.length).toBe(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it('should select exactly the requested count of active questions', async () => {
      const selected = await questionSelectorService.selectQuestions({
        subjectId: testSubjectId,
        type: 'BOTH',
        count: 2,
        order: 'SEQUENTIAL',
      });

      expect(selected.length).toBe(2);
      expect(selected[0].subject_id).toBe(testSubjectId);
    });

    it('sequential ordering should be deterministic across repeated calls', async () => {
      const run1 = await questionSelectorService.selectQuestions({
        subjectId: testSubjectId,
        type: 'BOTH',
        count: 3,
        order: 'SEQUENTIAL',
      });

      const run2 = await questionSelectorService.selectQuestions({
        subjectId: testSubjectId,
        type: 'BOTH',
        count: 3,
        order: 'SEQUENTIAL',
      });

      expect(run1.map((q) => q.id)).toEqual(run2.map((q) => q.id));
    });

    it('random ordering should return requested count of unique questions', async () => {
      const selected = await questionSelectorService.selectQuestions({
        subjectId: testSubjectId,
        type: 'BOTH',
        count: 3,
        order: 'RANDOM',
      });

      expect(selected.length).toBe(3);
      const uniqueIds = new Set(selected.map((q) => q.id));
      expect(uniqueIds.size).toBe(3);
    });

    it('throws InsufficientQuestionsError with code 422 when requested count exceeds availability', async () => {
      await expect(
        questionSelectorService.selectQuestions({
          subjectId: testSubjectId,
          type: 'BOTH',
          count: 9999, // Unreachable count
          order: 'SEQUENTIAL',
        })
      ).rejects.toThrow(/questions available/i);
    });
  });

  describe('POST /api/v1/quiz Supertest Integration', () => {
    it('rejects unauthenticated quiz generation requests (401)', async () => {
      const res = await request(app)
        .post('/api/v1/quiz')
        .send({
          subject_id: testSubjectId,
          requested_count: 5,
        });

      expect(res.status).toBe(401);
    });

    it('rejects quiz generation with chapter not belonging to subject (422)', async () => {
      const res = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', studentCookies)
        .send({
          subject_id: otherSubjectId, // Mismatch with testChapterId
          chapter_id: testChapterId,
          requested_count: 2,
          timer_mode: 'VARIABLE',
        });

      expect(res.status).toBe(422);
    });

    it('rejects fixed timer mode when timer_duration_seconds is missing or invalid (422)', async () => {
      const res = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          requested_count: 2,
          timer_mode: 'FIXED',
          // timer_duration_seconds omitted
        });

      expect(res.status).toBe(422);
    });

    it('rejects request when insufficient questions exist with HTTP 422 and available count', async () => {
      const res = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          requested_count: 100, // Exceeds single chapter seeded count
          timer_mode: 'VARIABLE',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INSUFFICIENT_QUESTIONS');
      expect(res.body.error.message).toMatch(/available/i);
    });

    it('successfully creates Quiz, QuizQuestion[] snapshots, and QuizAttempt(CREATED) transactionally', async () => {
      const res = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          requested_count: 3,
          question_type_filter: 'BOTH',
          order_mode: 'RANDOM',
          timer_mode: 'FIXED',
          timer_duration_seconds: 600, // 10 minutes
        });

      expect(res.status).toBe(201);
      expect(res.body.quizId).toBeDefined();
      expect(res.body.attemptId).toBeDefined();

      createdQuizIds.push(res.body.quizId);
      createdAttemptIds.push(res.body.attemptId);

      // Verify Quiz row in DB
      const quizInDb = await prisma.quiz.findUnique({
        where: { id: res.body.quizId },
        include: { quiz_questions: true },
      });
      expect(quizInDb).toBeDefined();
      expect(quizInDb?.requested_count).toBe(3);
      expect(quizInDb?.timer_duration_seconds).toBe(600);
      expect(quizInDb?.quiz_questions.length).toBe(3);

      // Verify display_order is 1, 2, 3
      const orders = quizInDb?.quiz_questions.map((q) => q.display_order).sort();
      expect(orders).toEqual([1, 2, 3]);

      // Verify QuizAttempt created with CREATED status
      const attemptInDb = await prisma.quizAttempt.findUnique({
        where: { id: res.body.attemptId },
      });
      expect(attemptInDb).toBeDefined();
      expect(attemptInDb?.status).toBe('CREATED');
      expect(attemptInDb?.started_at).toBeNull();
    });

    it('GET /api/v1/quiz/:quizId returns quiz configuration without question answers', async () => {
      const quizId = createdQuizIds[0];
      const res = await request(app)
        .get(`/api/v1/quiz/${quizId}`)
        .set('Cookie', studentCookies);

      expect(res.status).toBe(200);
      expect(res.body.quiz.id).toBe(quizId);
      expect(res.body.quiz.actual_question_count).toBe(3);
      expect(res.body.quiz.requested_count).toBe(3);
      // Ensure no answers or questions are leaked
      expect(res.body.quiz.questions).toBeUndefined();
      expect(res.body.quiz.quiz_questions).toBeUndefined();
    });
  });
});
