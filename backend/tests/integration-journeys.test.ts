import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { QuestionType, Difficulty, QuestionStatus } from '@prisma/client';

describe('End-to-End Local Integration Pass (PROMPT 25)', () => {
  let adminCookies: string[];
  let studentCookies: string[];
  let studentEmail: string;
  let studentUserId: string;

  beforeAll(async () => {
    // 1. Authenticate seeded admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@examprep.dev', password: 'AdminDev123!' });
    expect(adminLoginRes.status).toBe(200);
    adminCookies = adminLoginRes.headers['set-cookie'] as unknown as string[];

    // 2. Register and login a unique student for clean isolated integration run
    studentEmail = `student-e2e-${Date.now()}@examprep.dev`;
    const studentRegisterRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        password: 'Password123!',
        name: 'E2E Test Student',
      });
    expect(studentRegisterRes.status).toBe(201);
    studentUserId = studentRegisterRes.body.user.id;

    const studentLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: studentEmail,
        password: 'Password123!',
      });
    expect(studentLoginRes.status).toBe(200);
    studentCookies = studentLoginRes.headers['set-cookie'] as unknown as string[];
  });

  afterAll(async () => {
    // Clean up test student attempts, quizzes, and user in correct foreign key order
    if (studentUserId) {
      await prisma.submittedAnswer.deleteMany({ where: { attempt: { user_id: studentUserId } } });
      await prisma.result.deleteMany({ where: { attempt: { user_id: studentUserId } } });
      await prisma.quizAttempt.deleteMany({ where: { user_id: studentUserId } });
      await prisma.quizQuestion.deleteMany({ where: { quiz: { created_by_user_id: studentUserId } } });
      await prisma.quiz.deleteMany({ where: { created_by_user_id: studentUserId } });
      await prisma.refreshToken.deleteMany({ where: { user_id: studentUserId } });
      await prisma.user.deleteMany({ where: { id: studentUserId } });
    }
    await prisma.$disconnect();
  });

  describe('1. Full Student End-to-End Journey', () => {
    let subjectId: string;
    let chapterId: string;
    let fixedAttemptId: string;
    let variableAttemptId: string;

    it('Step 1: Student browses active curriculum & checks available question counts', async () => {
      // Fetch subjects
      const subjectsRes = await request(app)
        .get('/api/v1/subjects')
        .set('Cookie', studentCookies);
      expect(subjectsRes.status).toBe(200);
      expect(Array.isArray(subjectsRes.body.data)).toBe(true);
      expect(subjectsRes.body.data.length).toBeGreaterThan(0);

      const dbmsSubject = subjectsRes.body.data.find((s: { name: string }) => s.name === 'DBMS') || subjectsRes.body.data[0];
      subjectId = dbmsSubject.id;

      // Fetch chapters
      const chaptersRes = await request(app)
        .get(`/api/v1/subjects/${subjectId}/chapters`)
        .set('Cookie', studentCookies);
      expect(chaptersRes.status).toBe(200);
      expect(Array.isArray(chaptersRes.body.data)).toBe(true);
      expect(chaptersRes.body.data.length).toBeGreaterThan(0);

      chapterId = chaptersRes.body.data[0].id;

      // Check available questions count
      const countRes = await request(app)
        .get('/api/v1/questions/available-count')
        .query({ subjectId, chapterId, type: 'BOTH' })
        .set('Cookie', studentCookies);
      expect(countRes.status).toBe(200);
      expect(typeof countRes.body.count).toBe('number');
    });

    it('Step 2: Student configures and generates a FIXED-timer quiz', async () => {
      const generateRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: subjectId,
          chapter_id: chapterId,
          question_type_filter: 'BOTH',
          requested_count: 2,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'FIXED',
          timer_duration_seconds: 180,
        });

      expect(generateRes.status).toBe(201);
      fixedAttemptId = generateRes.body.attemptId || generateRes.body.attempt?.id;
      expect(fixedAttemptId).toBeDefined();
    });

    it('Step 3: Student starts FIXED quiz, solves questions, and submits', async () => {
      // Start attempt
      const startRes = await request(app)
        .post(`/api/v1/attempts/${fixedAttemptId}/start`)
        .set('Cookie', studentCookies);
      expect(startRes.status).toBe(200);
      expect(startRes.body.status).toBe('IN_PROGRESS');

      // Fetch attempt state & questions
      const getAttemptRes = await request(app)
        .get(`/api/v1/attempts/${fixedAttemptId}`)
        .set('Cookie', studentCookies);
      expect(getAttemptRes.status).toBe(200);
      const questions = getAttemptRes.body.questions;
      expect(questions.length).toBeGreaterThan(0);

      // Verify correct_answer and explanation are EXCLUDED during active solving
      expect(questions[0].correct_answer).toBeUndefined();
      expect(questions[0].explanation).toBeUndefined();

      // Answer question 1
      const q1 = questions[0];
      const opt1 = typeof q1.options[0] === 'string' ? q1.options[0] : q1.options[0].text;
      const save1Res = await request(app)
        .put(`/api/v1/attempts/${fixedAttemptId}/answers/${q1.quiz_question_id}`)
        .set('Cookie', studentCookies)
        .send({ selected_option: opt1 });
      expect(save1Res.status).toBe(200);

      // Submit the attempt
      const submitRes = await request(app)
        .post(`/api/v1/attempts/${fixedAttemptId}/submit`)
        .set('Cookie', studentCookies);
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.status).toBe('EVALUATED');
    });

    it('Step 4: Student reviews FIXED quiz results with frozen scoring & explanation reveal', async () => {
      const resultsRes = await request(app)
        .get(`/api/v1/attempts/${fixedAttemptId}/result`)
        .set('Cookie', studentCookies);

      expect(resultsRes.status).toBe(200);
      expect(resultsRes.body.result).toBeDefined();
      expect(resultsRes.body.result.total_questions).toBeGreaterThan(0);
      expect(typeof resultsRes.body.result.marks_obtained).toBe('number');
      expect(typeof resultsRes.body.result.percentage).toBe('number');
      expect(Array.isArray(resultsRes.body.questions)).toBe(true);

      // Verify explanations and correct_answers ARE revealed after evaluation
      const firstQ = resultsRes.body.questions[0];
      expect(firstQ.correct_answer).toBeDefined();
      expect(typeof firstQ.is_correct).toBe('boolean');
    });

    it('Step 5: Student configures, generates, and completes a VARIABLE-timer quiz', async () => {
      // Generate VARIABLE timer quiz
      const generateRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: subjectId,
          chapter_id: chapterId,
          question_type_filter: 'BOTH',
          requested_count: 2,
          order_mode: 'RANDOM',
          timer_mode: 'VARIABLE',
        });

      expect(generateRes.status).toBe(201);
      variableAttemptId = generateRes.body.attemptId || generateRes.body.attempt?.id;
      expect(variableAttemptId).toBeDefined();

      // Start attempt
      await request(app)
        .post(`/api/v1/attempts/${variableAttemptId}/start`)
        .set('Cookie', studentCookies);

      // Submit attempt
      const submitRes = await request(app)
        .post(`/api/v1/attempts/${variableAttemptId}/submit`)
        .set('Cookie', studentCookies);

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.status).toBe('EVALUATED');
    });

    it('Step 6: Student views Attempt History and Analytics', async () => {
      // Fetch History
      const historyRes = await request(app)
        .get('/api/v1/attempts')
        .set('Cookie', studentCookies);

      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
      expect(historyRes.body.data.length).toBeGreaterThanOrEqual(2);

      // Fetch Analytics Summary
      const summaryRes = await request(app)
        .get('/api/v1/analytics/summary')
        .set('Cookie', studentCookies);

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.summary.total_attempts).toBeGreaterThanOrEqual(2);
      expect(typeof summaryRes.body.summary.average_accuracy).toBe('number');

      // Fetch Analytics Chapter breakdown
      const chaptersPerfRes = await request(app)
        .get('/api/v1/analytics/chapter-performance')
        .set('Cookie', studentCookies);

      expect(chaptersPerfRes.status).toBe(200);
      expect(Array.isArray(chaptersPerfRes.body.chapters)).toBe(true);
    });
  });

  describe('2. Full Admin End-to-End Journey', () => {
    let createdSubjectId: string;
    let createdChapterId: string;
    let createdQuestionId: string;

    it('Step 1: Admin creates a new Subject', async () => {
      const res = await request(app)
        .post('/api/v1/subjects')
        .set('Cookie', adminCookies)
        .send({
          name: `Integration Test Subject ${Date.now()}`,
          description: 'Created during PROMPT 25 integration pass',
        });

      expect(res.status).toBe(201);
      expect(res.body.subject.id).toBeDefined();
      createdSubjectId = res.body.subject.id;
    });

    it('Step 2: Admin creates a new Chapter under the Subject', async () => {
      const res = await request(app)
        .post('/api/v1/chapters')
        .set('Cookie', adminCookies)
        .send({
          subject_id: createdSubjectId,
          name: 'Integration Test Chapter 1',
        });

      expect(res.status).toBe(201);
      expect(res.body.chapter.id).toBeDefined();
      createdChapterId = res.body.chapter.id;
    });

    it('Step 3: Admin creates a manual Question with options & correct answer', async () => {
      const res = await request(app)
        .post('/api/v1/questions')
        .set('Cookie', adminCookies)
        .send({
          subject_id: createdSubjectId,
          chapter_id: createdChapterId,
          question_text: 'What does CRC stand for in computer networks?',
          options: [
            { text: 'Cyclic Redundancy Check' },
            { text: 'Code Routing Control' },
            { text: 'Central Relay Circuit' },
            { text: 'Carrier Reset Channel' },
          ],
          correct_answer: 'Cyclic Redundancy Check',
          explanation: 'CRC is an error-detecting code commonly used in digital networks.',
          question_type: QuestionType.CONCEPT,
          difficulty: Difficulty.EASY,
          status: QuestionStatus.ACTIVE,
        });

      expect(res.status).toBe(201);
      expect(res.body.question.id).toBeDefined();
      expect(res.body.question.status).toBe(QuestionStatus.ACTIVE);
      createdQuestionId = res.body.question.id;
    });

    it('Step 4: Newly created question is immediately usable by Quiz Generation', async () => {
      // Check available count
      const countRes = await request(app)
        .get('/api/v1/questions/available-count')
        .query({ subjectId: createdSubjectId, chapterId: createdChapterId, type: 'BOTH' })
        .set('Cookie', studentCookies);

      expect(countRes.status).toBe(200);
      expect(countRes.body.count).toBe(1);

      // Generate a quiz from the newly created question
      const quizRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: createdSubjectId,
          chapter_id: createdChapterId,
          question_type_filter: 'BOTH',
          requested_count: 1,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });

      expect(quizRes.status).toBe(201);
      expect(quizRes.body.quizId || quizRes.body.quiz?.id).toBeDefined();
    });

    it('Step 5: Admin reviews dashboard overview metrics', async () => {
      const dashRes = await request(app)
        .get('/api/v1/admin/dashboard-summary')
        .set('Cookie', adminCookies);

      expect(dashRes.status).toBe(200);
      const summaryData = dashRes.body.summary || dashRes.body;
      expect(typeof summaryData.subjects_count).toBe('number');
      expect(typeof summaryData.chapters_count).toBe('number');
      expect(typeof summaryData.active_questions_count).toBe('number');
    });

    afterAll(async () => {
      // Clean up integration subject, chapter, and question in proper order
      if (createdQuestionId) {
        await prisma.submittedAnswer.deleteMany({ where: { quiz_question: { question_id: createdQuestionId } } });
        await prisma.quizQuestion.deleteMany({ where: { question_id: createdQuestionId } });
        await prisma.question.deleteMany({ where: { id: createdQuestionId } });
      }
      if (createdChapterId) {
        await prisma.submittedAnswer.deleteMany({ where: { attempt: { quiz: { chapter_id: createdChapterId } } } });
        await prisma.result.deleteMany({ where: { attempt: { quiz: { chapter_id: createdChapterId } } } });
        await prisma.quizAttempt.deleteMany({ where: { quiz: { chapter_id: createdChapterId } } });
        await prisma.quizQuestion.deleteMany({ where: { quiz: { chapter_id: createdChapterId } } });
        await prisma.quiz.deleteMany({ where: { chapter_id: createdChapterId } });
        await prisma.chapter.deleteMany({ where: { id: createdChapterId } });
      }
      if (createdSubjectId) {
        await prisma.submittedAnswer.deleteMany({ where: { attempt: { quiz: { subject_id: createdSubjectId } } } });
        await prisma.result.deleteMany({ where: { attempt: { quiz: { subject_id: createdSubjectId } } } });
        await prisma.quizAttempt.deleteMany({ where: { quiz: { subject_id: createdSubjectId } } });
        await prisma.quizQuestion.deleteMany({ where: { quiz: { subject_id: createdSubjectId } } });
        await prisma.quiz.deleteMany({ where: { subject_id: createdSubjectId } });
        await prisma.subject.deleteMany({ where: { id: createdSubjectId } });
      }
    });
  });

  describe('3. Security & Access Control Verification', () => {
    it('Blocks students from accessing admin-only Subject creation', async () => {
      const res = await request(app)
        .post('/api/v1/subjects')
        .set('Cookie', studentCookies)
        .send({ name: 'Hacked Subject' });

      expect(res.status).toBe(403);
    });

    it('Blocks students from creating questions directly', async () => {
      const res = await request(app)
        .post('/api/v1/questions')
        .set('Cookie', studentCookies)
        .send({
          subject_id: '00000001-0000-0000-0000-000000000001',
          chapter_id: '00000001-0000-0000-0000-000000000011',
          question_text: 'Unauthorized question',
          options: [{ text: 'A' }, { text: 'B' }],
          correct_answer: 'A',
          question_type: 'CONCEPT',
        });

      expect(res.status).toBe(403);
    });

    it('Blocks students from accessing admin dashboard analytics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard-summary')
        .set('Cookie', studentCookies);

      expect(res.status).toBe(403);
    });

    it('Blocks unauthenticated requests from protected endpoints', async () => {
      const res = await request(app).get('/api/v1/attempts');
      expect(res.status).toBe(401);
    });
  });
});
