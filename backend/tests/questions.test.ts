import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

let adminCookies: string[] = [];
let studentCookies: string[] = [];
let createdQuestionId: string;
let testSubjectId: string;
let testChapterId: string;

beforeAll(async () => {
  // Get a subject and a chapter for testing
  const subject = await prisma.subject.findFirst({
    where: { is_active: true },
    select: { id: true },
  });
  if (!subject) throw new Error('No active subject found');
  testSubjectId = subject.id;

  const chapter = await prisma.chapter.findFirst({
    where: { is_active: true, subject_id: testSubjectId },
    select: { id: true },
  });
  if (!chapter) throw new Error('No active chapter found');
  testChapterId = chapter.id;

  // Admin login
  const adminRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@examprep.dev', password: 'AdminDev123!' });
  adminCookies = adminRes.headers['set-cookie'] as unknown as string[];

  // Student login (use a seeded student or register new)
  const studentRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'student@examprep.dev', password: 'StudentDev123!' });
  studentCookies = studentRes.headers['set-cookie'] as unknown as string[];
});

afterAll(async () => {
  // Clean up created question if it exists
  if (createdQuestionId) {
    await prisma.question.delete({ where: { id: createdQuestionId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('Question Management (Backend)', () => {
  it('should create a valid CONCEPT question as admin', async () => {
    const res = await request(app)
      .post('/api/v1/questions')
      .set('Cookie', adminCookies)
      .send({
        question_text: 'What is 2+2?',
        options: [{ text: '3' }, { text: '4' }],
        correct_answer: '4',
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_type: 'CONCEPT',
      });
    expect(res.status).toBe(201);
    expect(res.body.question).toBeDefined();
    createdQuestionId = res.body.question.id;
    expect(res.body.question.status).toBe('DRAFT');
  });

  it('should reject creation with mismatched correct answer (422)', async () => {
    const res = await request(app)
      .post('/api/v1/questions')
      .set('Cookie', adminCookies)
      .send({
        question_text: 'Invalid answer test',
        options: [{ text: 'A' }, { text: 'B' }],
        correct_answer: 'C',
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_type: 'CONCEPT',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('should reject PYQ without exam metadata (422)', async () => {
    const res = await request(app)
      .post('/api/v1/questions')
      .set('Cookie', adminCookies)
      .send({
        question_text: 'PYQ missing meta',
        options: [{ text: 'X' }, { text: 'Y' }],
        correct_answer: 'X',
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_type: 'PYQ',
      });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('should forbid a student from creating a question (403)', async () => {
    const res = await request(app)
      .post('/api/v1/questions')
      .set('Cookie', studentCookies)
      .send({
        question_text: 'Student attempt',
        options: [{ text: '1' }, { text: '2' }],
        correct_answer: '1',
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_type: 'CONCEPT',
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should update an existing question as admin', async () => {
    const res = await request(app)
      .patch(`/api/v1/questions/${createdQuestionId}`)
      .set('Cookie', adminCookies)
      .send({ difficulty: 'EASY' });
    expect(res.status).toBe(200);
    expect(res.body.question.difficulty).toBe('EASY');
  });

  it('should soft‑deactivate a question as admin', async () => {
    const res = await request(app)
      .patch(`/api/v1/questions/${createdQuestionId}/deactivate`)
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.question.status).toBe('INACTIVE');
    // Verify row still exists
    const db = await prisma.question.findUnique({ where: { id: createdQuestionId } });
    expect(db).toBeDefined();
    expect(db?.status).toBe('INACTIVE');
  });

  it('should return paginated list for admin', async () => {
    const res = await request(app)
      .get('/api/v1/questions?page=1&limit=5')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  it('should return available count for any authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/questions/available-count')
      .set('Cookie', studentCookies)
      .query({ subjectId: testSubjectId, type: 'CONCEPT' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(typeof res.body.count).toBe('number');
  });

  it('should bulk update questions by ID (activate and set difficulty)', async () => {
    // Create 2 draft questions
    const q1 = await prisma.question.create({
      data: {
        question_text: 'Bulk test Q1',
        options: [{ text: 'A' }, { text: 'B' }] as any,
        correct_answer: 'A',
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_type: 'CONCEPT',
        status: 'DRAFT',
        difficulty: 'EASY',
        source: 'MANUAL',
        created_by: (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))!.id,
      },
    });
    const q2 = await prisma.question.create({
      data: {
        question_text: 'Bulk test Q2',
        options: [{ text: '1' }, { text: '2' }] as any,
        correct_answer: '1',
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_type: 'CONCEPT',
        status: 'DRAFT',
        difficulty: 'EASY',
        source: 'MANUAL',
        created_by: (await prisma.user.findFirst({ where: { role: 'ADMIN' } }))!.id,
      },
    });

    try {
      // 1. Bulk activate both
      const activateRes = await request(app)
        .patch('/api/v1/questions/bulk')
        .set('Cookie', adminCookies)
        .send({
          ids: [q1.id, q2.id],
          updates: { status: 'ACTIVE' },
        });

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.count).toBe(2);

      const check1 = await prisma.question.findMany({
        where: { id: { in: [q1.id, q2.id] } },
      });
      expect(check1.every((q) => q.status === 'ACTIVE')).toBe(true);

      // 2. Bulk set difficulty to HARD
      const diffRes = await request(app)
        .patch('/api/v1/questions/bulk')
        .set('Cookie', adminCookies)
        .send({
          ids: [q1.id, q2.id],
          updates: { difficulty: 'HARD' },
        });

      expect(diffRes.status).toBe(200);
      expect(diffRes.body.count).toBe(2);

      const check2 = await prisma.question.findMany({
        where: { id: { in: [q1.id, q2.id] } },
      });
      expect(check2.every((q) => q.difficulty === 'HARD')).toBe(true);

      // 3. Bulk update using filter criteria
      const filterRes = await request(app)
        .patch('/api/v1/questions/bulk')
        .set('Cookie', adminCookies)
        .send({
          filter: { search: 'Bulk test Q' },
          updates: { difficulty: 'MEDIUM' },
        });

      expect(filterRes.status).toBe(200);
      expect(filterRes.body.count).toBeGreaterThanOrEqual(2);

      const check3 = await prisma.question.findMany({
        where: { id: { in: [q1.id, q2.id] } },
      });
      expect(check3.every((q) => q.difficulty === 'MEDIUM')).toBe(true);
    } finally {
      await prisma.question.deleteMany({
        where: { id: { in: [q1.id, q2.id] } },
      });
    }
  });

  it('should reject bulk update without updates payload (422)', async () => {
    const res = await request(app)
      .patch('/api/v1/questions/bulk')
      .set('Cookie', adminCookies)
      .send({
        ids: ['00000000-0000-0000-0000-000000000001'],
        updates: {},
      });
    expect(res.status).toBe(422);
  });

  it('should forbid student from performing bulk updates (403)', async () => {
    const res = await request(app)
      .patch('/api/v1/questions/bulk')
      .set('Cookie', studentCookies)
      .send({
        ids: ['00000000-0000-0000-0000-000000000001'],
        updates: { status: 'ACTIVE' },
      });
    expect(res.status).toBe(403);
  });
});

