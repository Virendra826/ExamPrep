import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

let student1Cookies: string[] = [];
let student2Cookies: string[] = [];
let testSubjectId: string;
let testQuizId: string;
let testAttemptId: string;
let testQuizQuestionId: string;
let createdQuizIds: string[] = [];
let createdAttemptIds: string[] = [];

beforeAll(async () => {
  // Find an active subject
  const subject = await prisma.subject.findFirst({
    where: { is_active: true, questions: { some: { status: 'ACTIVE' } } },
  });

  if (!subject) {
    throw new Error('Seed data required: at least one active subject with active questions');
  }
  testSubjectId = subject.id;

  // Student 1 login
  const student1Res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'student@examprep.dev', password: 'StudentDev123!' });
  student1Cookies = student1Res.headers['set-cookie'] as unknown as string[];

  // Student 2 register/login
  const student2Email = `student2_${Date.now()}@examprep.dev`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({
      email: student2Email,
      password: 'StudentDev123!',
      name: 'Second Student',
    });

  const student2Res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: student2Email, password: 'StudentDev123!' });
  student2Cookies = student2Res.headers['set-cookie'] as unknown as string[];

  // Generate a quiz for Student 1
  const quizRes = await request(app)
    .post('/api/v1/quiz')
    .set('Cookie', student1Cookies)
    .send({
      subject_id: testSubjectId,
      requested_count: 3,
      timer_mode: 'VARIABLE',
      order_mode: 'RANDOM',
    });

  expect(quizRes.status).toBe(201);
  testQuizId = quizRes.body.quizId;
  testAttemptId = quizRes.body.attemptId;
  createdQuizIds.push(testQuizId);
  createdAttemptIds.push(testAttemptId);

  // Fetch a quiz question id
  const qq = await prisma.quizQuestion.findFirst({
    where: { quiz_id: testQuizId },
  });
  testQuizQuestionId = qq!.id;
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

describe('Attempt Lifecycle Backend (PROMPT 18)', () => {
  describe('Authentication & Ownership Enforcement', () => {
    it('rejects unauthenticated requests to attempt endpoints with 401', async () => {
      const res = await request(app).get(`/api/v1/attempts/${testAttemptId}`);
      expect(res.status).toBe(401);
    });

    it('rejects non-owner student access with 404 (does not leak existence)', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${testAttemptId}`)
        .set('Cookie', student2Cookies);

      expect(res.status).toBe(404);
    });

    it('rejects non-owner starting another user attempt with 404', async () => {
      const res = await request(app)
        .post(`/api/v1/attempts/${testAttemptId}/start`)
        .set('Cookie', student2Cookies);

      expect(res.status).toBe(404);
    });
  });

  describe('Attempt Start (POST /attempts/:attemptId/start)', () => {
    it('transitions attempt status from CREATED to IN_PROGRESS and sets started_at', async () => {
      const res = await request(app)
        .post(`/api/v1/attempts/${testAttemptId}/start`)
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(200);
      expect(res.body.attemptId).toBe(testAttemptId);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.started_at).toBeDefined();
    });

    it('rejects double-start with 409 Conflict', async () => {
      const res = await request(app)
        .post(`/api/v1/attempts/${testAttemptId}/start`)
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/already started/i);
    });
  });

  describe('Get Attempt State (GET /attempts/:attemptId)', () => {
    it('returns quiz config, questions, and submitted answers, strictly excluding correct_answer and explanation', async () => {
      const res = await request(app)
        .get(`/api/v1/attempts/${testAttemptId}`)
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(200);
      expect(res.body.attempt).toBeDefined();
      expect(res.body.attempt.status).toBe('IN_PROGRESS');
      expect(res.body.quiz).toBeDefined();
      expect(res.body.questions).toBeDefined();
      expect(res.body.questions.length).toBe(3);

      // SECURITY CRITICAL: Ensure neither correct_answer nor explanation leaks
      for (const q of res.body.questions) {
        expect(q.correct_answer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
        expect(q.quiz_question_id).toBeDefined();
        expect(q.question_text).toBeDefined();
        expect(q.options).toBeDefined();
      }
    });
  });

  describe('Answer Submission (PUT /attempts/:attemptId/answers/:quizQuestionId)', () => {
    it('upserts a submitted answer while attempt is IN_PROGRESS', async () => {
      const res = await request(app)
        .put(`/api/v1/attempts/${testAttemptId}/answers/${testQuizQuestionId}`)
        .set('Cookie', student1Cookies)
        .send({ selected_option: 'Option A' });

      expect(res.status).toBe(200);
      expect(res.body.answer).toBeDefined();
      expect(res.body.answer.quiz_question_id).toBe(testQuizQuestionId);
      expect(res.body.answer.selected_option).toBe('Option A');

      // Verify it updates on subsequent save
      const resUpdate = await request(app)
        .put(`/api/v1/attempts/${testAttemptId}/answers/${testQuizQuestionId}`)
        .set('Cookie', student1Cookies)
        .send({ selected_option: 'Option B' });

      expect(resUpdate.status).toBe(200);
      expect(resUpdate.body.answer.selected_option).toBe('Option B');
    });

    it('rejects answer submission for quiz question not belonging to quiz', async () => {
      const fakeQuestionId = '00000000-0000-0000-0000-000000000099';
      const res = await request(app)
        .put(`/api/v1/attempts/${testAttemptId}/answers/${fakeQuestionId}`)
        .set('Cookie', student1Cookies)
        .send({ selected_option: 'Option A' });

      expect(res.status).toBe(400);
    });
  });

  describe('Attempt Final Submit (POST /attempts/:attemptId/submit)', () => {
    it('transitions IN_PROGRESS to SUBMITTED and computes time_taken_seconds', async () => {
      const res = await request(app)
        .post(`/api/v1/attempts/${testAttemptId}/submit`)
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(200);
      expect(res.body.attemptId).toBe(testAttemptId);
      expect(['SUBMITTED', 'EVALUATED']).toContain(res.body.status);
      expect(res.body.submitted_at).toBeDefined();
      expect(typeof res.body.time_taken_seconds).toBe('number');
    });

    it('is idempotent: calling submit again on a submitted attempt returns existing state', async () => {
      const res = await request(app)
        .post(`/api/v1/attempts/${testAttemptId}/submit`)
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(200);
      expect(['SUBMITTED', 'EVALUATED']).toContain(res.body.status);
    });

    it('rejects answer submission after attempt is submitted (409 Conflict)', async () => {
      const res = await request(app)
        .put(`/api/v1/attempts/${testAttemptId}/answers/${testQuizQuestionId}`)
        .set('Cookie', student1Cookies)
        .send({ selected_option: 'Option C' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/not in progress/i);
    });
  });

  describe('Attempt History (GET /attempts)', () => {
    it('returns paginated history list of attempts for authenticated user', async () => {
      const res = await request(app)
        .get('/api/v1/attempts')
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.data.some((a: any) => a.id === testAttemptId)).toBe(true);

      // Student 2 history should not contain Student 1's attempt
      const res2 = await request(app)
        .get('/api/v1/attempts')
        .set('Cookie', student2Cookies);

      expect(res2.status).toBe(200);
      expect(res2.body.data.some((a: any) => a.id === testAttemptId)).toBe(false);
    });
  });

  describe('Timer Enforcement & Timeout (PROMPT 20)', () => {
    let fixedQuizId: string;
    let fixedAttemptId: string;
    let fixedQuizQuestionId: string;

    beforeAll(async () => {
      // Create a FIXED timer quiz (60 seconds)
      const res = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', student1Cookies)
        .send({
          subject_id: testSubjectId,
          requested_count: 2,
          timer_mode: 'FIXED',
          timer_duration_seconds: 60,
          order_mode: 'RANDOM',
        });

      fixedQuizId = res.body.quizId;
      fixedAttemptId = res.body.attemptId;
      createdQuizIds.push(fixedQuizId);
      createdAttemptIds.push(fixedAttemptId);

      const qq = await prisma.quizQuestion.findFirst({
        where: { quiz_id: fixedQuizId },
      });
      fixedQuizQuestionId = qq!.id;

      // Start attempt
      await request(app)
        .post(`/api/v1/attempts/${fixedAttemptId}/start`)
        .set('Cookie', student1Cookies);
    });

    it('rejects POST /timeout if attempt has not yet expired (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/attempts/${fixedAttemptId}/timeout`)
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/not yet expired/i);
    });

    it('POST /timeout succeeds once elapsed time exceeds duration', async () => {
      // Artificially move started_at 120 seconds into the past
      await prisma.quizAttempt.update({
        where: { id: fixedAttemptId },
        data: { started_at: new Date(Date.now() - 120 * 1000) },
      });

      const res = await request(app)
        .post(`/api/v1/attempts/${fixedAttemptId}/timeout`)
        .set('Cookie', student1Cookies);

      expect(res.status).toBe(200);
      expect(['TIMEOUT', 'EVALUATED']).toContain(res.body.status);
      expect(res.body.time_taken_seconds).toBe(60);
    });

    it('auto-timeouts on PUT /answers when elapsed time exceeds duration and rejects answer save', async () => {
      // Create new FIXED timer attempt
      const resQuiz = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', student1Cookies)
        .send({
          subject_id: testSubjectId,
          requested_count: 2,
          timer_mode: 'FIXED',
          timer_duration_seconds: 30,
        });

      const newAttemptId = resQuiz.body.attemptId;
      createdQuizIds.push(resQuiz.body.quizId);
      createdAttemptIds.push(newAttemptId);

      // Start attempt and backdate started_at by 50 seconds (> 30s)
      await request(app)
        .post(`/api/v1/attempts/${newAttemptId}/start`)
        .set('Cookie', student1Cookies);

      await prisma.quizAttempt.update({
        where: { id: newAttemptId },
        data: { started_at: new Date(Date.now() - 50 * 1000) },
      });

      const qq = await prisma.quizQuestion.findFirst({
        where: { quiz_id: resQuiz.body.quizId },
      });

      // Attempting to answer now should trigger auto-timeout and reject
      const resAnswer = await request(app)
        .put(`/api/v1/attempts/${newAttemptId}/answers/${qq!.id}`)
        .set('Cookie', student1Cookies)
        .send({ selected_option: 'Some Answer' });

      expect(resAnswer.status).toBe(409);
      expect(resAnswer.body.error.message).toMatch(/not in progress/i);

      // Confirm attempt status transitioned to TIMEOUT/EVALUATED
      const updated = await prisma.quizAttempt.findUnique({
        where: { id: newAttemptId },
      });
      expect(['TIMEOUT', 'EVALUATED']).toContain(updated!.status);
    });

    it('auto-timeouts on GET /attempts/:attemptId and returns serverTimeRemainingSeconds = 0', async () => {
      // Create another FIXED timer attempt
      const resQuiz = await request(app)
        .post('/api/v1/quiz')
        .set('Cookie', student1Cookies)
        .send({
          subject_id: testSubjectId,
          requested_count: 2,
          timer_mode: 'FIXED',
          timer_duration_seconds: 40,
        });

      const newAttemptId = resQuiz.body.attemptId;
      createdQuizIds.push(resQuiz.body.quizId);
      createdAttemptIds.push(newAttemptId);

      // Start attempt and backdate
      await request(app)
        .post(`/api/v1/attempts/${newAttemptId}/start`)
        .set('Cookie', student1Cookies);

      await prisma.quizAttempt.update({
        where: { id: newAttemptId },
        data: { started_at: new Date(Date.now() - 60 * 1000) },
      });

      const resGet = await request(app)
        .get(`/api/v1/attempts/${newAttemptId}`)
        .set('Cookie', student1Cookies);

      expect(resGet.status).toBe(200);
      expect(['TIMEOUT', 'EVALUATED']).toContain(resGet.body.attempt.status);
      expect(resGet.body.serverTimeRemainingSeconds).toBe(0);
    });
  });
});
