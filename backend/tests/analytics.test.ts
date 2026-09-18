import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

describe('Attempt History & Analytics Backend (PROMPT 23)', () => {
  let student1Cookies: string[] = [];
  let student2Cookies: string[] = [];
  let testSubjectId: string;
  let testChapterId: string;
  let createdQuizIds: string[] = [];
  let createdAttemptIds: string[] = [];

  beforeAll(async () => {
    // 1. Student 1 login
    const s1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'student@examprep.dev', password: 'StudentDev123!' });
    student1Cookies = s1Res.headers['set-cookie'] as unknown as string[];

    // 2. Student 2 register + login
    const s2Email = `student_an_${Date.now()}@examprep.dev`;
    await request(app).post('/api/v1/auth/register').send({
      email: s2Email,
      password: 'StudentDev123!',
      name: 'Analytics Student',
    });
    const s2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: s2Email, password: 'StudentDev123!' });
    student2Cookies = s2Res.headers['set-cookie'] as unknown as string[];

    // 3. Pick subject and chapter with active questions
    const chapter = await prisma.chapter.findFirst({
      where: { is_active: true, subject: { is_active: true }, questions: { some: { status: 'ACTIVE' } } },
      include: { subject: true },
    });
    if (!chapter) throw new Error('No active chapter with questions found');
    testSubjectId = chapter.subject_id;
    testChapterId = chapter.id;

    // 4. Create and submit an evaluated attempt for Student 1
    const quizRes = await request(app)
      .post('/api/v1/quizzes')
      .set('Cookie', student1Cookies)
      .send({
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        requested_count: 2,
        timer_mode: 'VARIABLE',
      });

    const quizId = quizRes.body.quiz?.id || quizRes.body.quizId;
    const attemptId = quizRes.body.attempt?.id || quizRes.body.attemptId;
    if (quizId) createdQuizIds.push(quizId);
    if (attemptId) createdAttemptIds.push(attemptId);

    // Start attempt
    if (attemptId) {
      await request(app)
        .post(`/api/v1/attempts/${attemptId}/start`)
        .set('Cookie', student1Cookies);
    }

    // Answer 1 question
    const qq = await prisma.quizQuestion.findFirst({
      where: { quiz_id: quizId },
      include: { question: true },
    });

    await request(app)
      .put(`/api/v1/attempts/${attemptId}/answers/${qq!.id}`)
      .set('Cookie', student1Cookies)
      .send({ selected_option: qq!.question.correct_answer });

    // Submit attempt (EVALUATED)
    await request(app)
      .post(`/api/v1/attempts/${attemptId}/submit`)
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
    const res = await request(app).get('/api/v1/analytics/summary');
    expect(res.status).toBe(401);

    const res2 = await request(app).get('/api/v1/analytics/chapter-performance');
    expect(res2.status).toBe(401);
  });

  it('returns clean zero-state for student with zero evaluated attempts', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Cookie', student2Cookies);

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      total_attempts: 0,
      best_score: 0,
      average_percentage: 0,
      average_accuracy: 0,
      average_time_per_question: 0,
    });

    const resChaps = await request(app)
      .get('/api/v1/analytics/chapter-performance')
      .set('Cookie', student2Cookies);

    expect(resChaps.status).toBe(200);
    expect(resChaps.body.chapters).toEqual([]);
  });

  it('returns aggregated summary for student with evaluated attempts', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Cookie', student1Cookies);

    expect(res.status).toBe(200);
    expect(res.body.summary.total_attempts).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.summary.average_percentage).toBe('number');
    expect(typeof res.body.summary.average_accuracy).toBe('number');
    expect(typeof res.body.summary.best_score).toBe('number');
  });

  it('returns chapter-level performance grouping for student', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/chapter-performance')
      .set('Cookie', student1Cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.chapters)).toBe(true);
    expect(res.body.chapters.length).toBeGreaterThanOrEqual(1);

    const item = res.body.chapters[0];
    expect(item.chapter_id).toBeDefined();
    expect(item.chapter_name).toBeDefined();
    expect(item.subject_name).toBeDefined();
    expect(typeof item.attempt_count).toBe('number');
    expect(typeof item.average_percentage).toBe('number');
    expect(typeof item.average_accuracy).toBe('number');
  });
});
