import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Result Endpoint & Review Backend (PROMPT 22)', () => {
  let student1Cookies: string[] = [];
  let student2Cookies: string[] = [];
  let adminCookies: string[] = [];
  let testSubjectId: string;
  let inProgressAttemptId: string;
  let evaluatedAttemptId: string;
  let evaluatedQuizId: string;
  let inProgressQuizId: string;
  let createdQuizIds: string[] = [];
  let createdAttemptIds: string[] = [];

  beforeAll(async () => {
    // 1. Student 1 login
    const s1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@examprep.dev', password: 'StudentDev123!' });
    student1Cookies = s1Res.headers['set-cookie'] as unknown as string[];

    // 2. Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@examprep.dev', password: 'AdminDev123!' });
    adminCookies = adminRes.headers['set-cookie'] as unknown as string[];

    // 3. Student 2 register + login
    const s2Email = `student_res_${Date.now()}@examprep.dev`;
    await request(app).post('/api/v1/auth/register').send({
      email: s2Email,
      password: 'StudentDev123!',
      name: 'Second Student',
    });
    const s2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: s2Email, password: 'StudentDev123!' });
    student2Cookies = s2Res.headers['set-cookie'] as unknown as string[];

    // 4. Fetch active subject
    const subject = await prisma.subject.findFirst({
      where: { is_active: true, questions: { some: { status: 'ACTIVE' } } },
    });
    testSubjectId = subject!.id;

    // 5. Create IN_PROGRESS attempt (not evaluated)
    const inProgRes = await request(app)
      .post('/api/v1/quiz')
      .set('Cookie', student1Cookies)
      .send({
        subject_id: testSubjectId,
        requested_count: 2,
        timer_mode: 'VARIABLE',
      });
    inProgressQuizId = inProgRes.body.quizId;
    inProgressAttemptId = inProgRes.body.attemptId;
    createdQuizIds.push(inProgressQuizId);
    createdAttemptIds.push(inProgressAttemptId);

    await request(app)
      .post(`/api/v1/attempts/${inProgressAttemptId}/start`)
      .set('Cookie', student1Cookies);

    // 6. Create EVALUATED attempt
    const evalRes = await request(app)
      .post('/api/v1/quiz')
      .set('Cookie', student1Cookies)
      .send({
        subject_id: testSubjectId,
        requested_count: 2,
        timer_mode: 'VARIABLE',
      });
    evaluatedQuizId = evalRes.body.quizId;
    evaluatedAttemptId = evalRes.body.attemptId;
    createdQuizIds.push(evaluatedQuizId);
    createdAttemptIds.push(evaluatedAttemptId);

    await request(app)
      .post(`/api/v1/attempts/${evaluatedAttemptId}/start`)
      .set('Cookie', student1Cookies);

    // Submit it to trigger evaluation
    await request(app)
      .post(`/api/v1/attempts/${evaluatedAttemptId}/submit`)
      .set('Cookie', student1Cookies);
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

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get(`/api/v1/attempts/${evaluatedAttemptId}/result`);
    expect(res.status).toBe(401);
  });

  it('rejects non-owner student access with 404 (ownership check)', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${evaluatedAttemptId}/result`)
      .set('Cookie', student2Cookies);

    expect(res.status).toBe(404);
  });

  it('rejects not-yet-evaluated attempts with 409 Conflict', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${inProgressAttemptId}/result`)
      .set('Cookie', student1Cookies);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/not yet been evaluated/i);
  });

  it('returns full evaluated result and question-wise review for owner', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${evaluatedAttemptId}/result`)
      .set('Cookie', student1Cookies);

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.total_questions).toBe(2);
    expect(res.body.questions).toBeDefined();
    expect(res.body.questions.length).toBe(2);

    // Question-wise review contains correct_answer and explanation
    for (const q of res.body.questions) {
      expect(q.correct_answer).toBeDefined();
      expect(typeof q.is_correct).toBe('boolean');
      expect(q.quiz_question_id).toBeDefined();
      expect(q.question_text).toBeDefined();
      expect(q.options).toBeDefined();
    }
  });

  it('allows admin read-only access to any evaluated attempt result', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${evaluatedAttemptId}/result`)
      .set('Cookie', adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.attempt_id).toBe(evaluatedAttemptId);
  });

  it('SECURITY: GET /attempts/:attemptId STILL strictly excludes correct_answer and explanation', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${inProgressAttemptId}`)
      .set('Cookie', student1Cookies);

    expect(res.status).toBe(200);
    for (const q of res.body.questions) {
      expect(q.correct_answer).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }
  });
});
