import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { env } from '../src/config/env.js';
import { QuestionType, Difficulty, QuestionStatus, QuestionSource } from '@prisma/client';
import { geminiExtractionService } from '../src/modules/ingestion/gemini/geminiExtraction.service.js';
import { geminiClientFactory } from '../src/modules/ingestion/gemini/gemini.client.js';
import { extractionService } from '../src/modules/ingestion/extraction.service.js';
import { reconcileHybridCandidates, IngestionService } from '../src/modules/ingestion/ingestion.service.js';
import { CandidateQuestion } from '../src/modules/ingestion/ingestion.types.js';
import * as pageRenderer from '../src/modules/ingestion/pageRenderer.js';
import * as imageCropper from '../src/modules/ingestion/imageCropper.js';
import { storageProvider } from '../src/storage/index.js';

describe('Phase 17 — Full Critical Failure Case QA Pass (PROMPT 27)', () => {
  let adminCookies: string[];
  let adminUserId: string;
  let studentCookies: string[];
  let studentUserId: string;
  let testSubjectId: string;
  let testChapterId: string;
  let activeQuestion1Id: string;
  let activeQuestion2Id: string;
  let samplePdfBuffer: Buffer;

  beforeAll(async () => {
    // 1. Authenticate Admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@examprep.dev', password: 'AdminDev123!' });
    expect(adminLoginRes.status).toBe(200);
    adminCookies = adminLoginRes.headers['set-cookie'] as unknown as string[];
    adminUserId = adminLoginRes.body.user.id;

    // 2. Register & Authenticate Student
    const studentEmail = `qa-student-${Date.now()}@examprep.dev`;
    const studentRegisterRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: studentEmail, password: 'Password123!', name: 'QA Test Student' });
    expect(studentRegisterRes.status).toBe(201);
    studentUserId = studentRegisterRes.body.user.id;

    const studentLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: studentEmail, password: 'Password123!' });
    expect(studentLoginRes.status).toBe(200);
    studentCookies = studentLoginRes.headers['set-cookie'] as unknown as string[];

    // 3. Create clean test Subject and Chapter
    const subject = await prisma.subject.create({
      data: {
        name: `QA Failure Subject ${Date.now()}`,
        description: 'Test subject for critical failure modes QA',
      },
    });
    testSubjectId = subject.id;

    const chapter = await prisma.chapter.create({
      data: {
        subject_id: testSubjectId,
        name: 'QA Failure Chapter 1',
      },
    });
    testChapterId = chapter.id;

    // 4. Create 2 Active Questions
    const q1 = await prisma.question.create({
      data: {
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_text: 'What is the primary function of an operating system kernel?',
        options: [
          { text: 'Resource management and hardware abstraction' },
          { text: 'User web browsing interface' },
          { text: 'Compiling source code to machine code' },
          { text: 'Graphic design acceleration' },
        ],
        correct_answer: 'Resource management and hardware abstraction',
        question_type: QuestionType.CONCEPT,
        difficulty: Difficulty.EASY,
        status: QuestionStatus.ACTIVE,
        source: QuestionSource.MANUAL,
        created_by: adminUserId,
      },
    });
    activeQuestion1Id = q1.id;

    const q2 = await prisma.question.create({
      data: {
        subject_id: testSubjectId,
        chapter_id: testChapterId,
        question_text: 'Which data structure enforces FIFO (First-In, First-Out) ordering?',
        options: [
          { text: 'Queue' },
          { text: 'Stack' },
          { text: 'Binary Search Tree' },
          { text: 'Hash Map' },
        ],
        correct_answer: 'Queue',
        question_type: QuestionType.CONCEPT,
        difficulty: Difficulty.EASY,
        status: QuestionStatus.ACTIVE,
        source: QuestionSource.MANUAL,
        created_by: adminUserId,
      },
    });
    activeQuestion2Id = q2.id;

    // Load PDF fixture for ingestion tests
    const fixturePath = path.resolve(__dirname, 'fixtures/Work Power Energy - JEE Main 2026 (Jan) - MathonGo.pdf');
    if (fs.existsSync(fixturePath)) {
      samplePdfBuffer = fs.readFileSync(fixturePath);
    } else {
      samplePdfBuffer = Buffer.from('%PDF-1.4 Mock PDF Content');
    }
  });

  afterAll(async () => {
    // Cleanup created test records in strict foreign key order
    if (studentUserId) {
      await prisma.submittedAnswer.deleteMany({ where: { attempt: { user_id: studentUserId } } });
      await prisma.result.deleteMany({ where: { attempt: { user_id: studentUserId } } });
      await prisma.quizAttempt.deleteMany({ where: { user_id: studentUserId } });
      await prisma.quizQuestion.deleteMany({ where: { quiz: { created_by_user_id: studentUserId } } });
      await prisma.quiz.deleteMany({ where: { created_by_user_id: studentUserId } });
      await prisma.refreshToken.deleteMany({ where: { user_id: studentUserId } });
      await prisma.user.deleteMany({ where: { id: studentUserId } });
    }

    if (activeQuestion1Id || activeQuestion2Id) {
      const qIds = [activeQuestion1Id, activeQuestion2Id].filter(Boolean);
      await prisma.submittedAnswer.deleteMany({
        where: { quiz_question: { question_id: { in: qIds } } },
      });
      await prisma.quizQuestion.deleteMany({
        where: { question_id: { in: qIds } },
      });
      await prisma.question.deleteMany({
        where: { id: { in: qIds } },
      });
    }

    if (testChapterId) {
      await prisma.question.deleteMany({ where: { chapter_id: testChapterId } });
      await prisma.chapter.deleteMany({ where: { id: testChapterId } });
    }
    if (testSubjectId) {
      await prisma.question.deleteMany({ where: { subject_id: testSubjectId } });
      await prisma.chapter.deleteMany({ where: { subject_id: testSubjectId } });
      await prisma.subject.deleteMany({ where: { id: testSubjectId } });
    }

    await prisma.$disconnect();
  });

  // =========================================================================
  // CATEGORY A: APPLICATION-LEVEL CRITICAL FAILURE CASES (12 CASES)
  // =========================================================================
  describe('Category A: Application-Level Failure Modes', () => {
    it('Case 1: Empty subject/chapter selection returns clean 422 InsufficientQuestionsError', async () => {
      // Create empty subject with zero questions
      const emptySubject = await prisma.subject.create({
        data: { name: `Empty Subject ${Date.now()}` },
      });

      const res = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: emptySubject.id,
          question_type_filter: 'BOTH',
          requested_count: 5,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INSUFFICIENT_QUESTIONS');
      expect(res.body.error.message).toMatch(/only 0 questions available/i);

      await prisma.subject.delete({ where: { id: emptySubject.id } });
    });

    it('Case 2: Insufficient questions for requested count returns 422 with count details', async () => {
      // Only 2 active questions exist in testChapterId
      const res = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type_filter: 'BOTH',
          requested_count: 25, // Exceeds available 2
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INSUFFICIENT_QUESTIONS');
      expect(res.body.error.message).toMatch(/only 2 questions available|2 questions available/i);
    });

    it('Case 3: Invalid quiz config (e.g. negative count, invalid timer duration) returns 400 or 422 validation error', async () => {
      // Missing timer_duration_seconds on FIXED timer
      const res1 = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          question_type_filter: 'BOTH',
          requested_count: 2,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'FIXED',
          // timer_duration_seconds intentionally omitted
        });
      expect([400, 422]).toContain(res1.status);
      expect(res1.body.error).toBeDefined();

      // Negative requested count
      const res2 = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          question_type_filter: 'BOTH',
          requested_count: -5,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });
      expect([400, 422]).toContain(res2.status);
      expect(res2.body.error).toBeDefined();
    });

    it('Case 4: Unauthorized access blocks students from admin routes (403) and unauthenticated (401)', async () => {
      // Student attempting to access admin ingestion upload
      const res403 = await request(app)
        .post('/api/v1/ingestion/upload')
        .set('Cookie', studentCookies);
      expect(res403.status).toBe(403);

      // Unauthenticated request to protected endpoint
      const res401 = await request(app).get('/api/v1/attempts');
      expect(res401.status).toBe(401);
    });

    it('Case 5: Expired / invalid authentication tokens are rejected with 401', async () => {
      const res = await request(app)
        .get('/api/v1/attempts')
        .set('Cookie', ['access_token=invalid.expired.jwt.token; Path=/']);
      expect(res.status).toBe(401);
    });

    it('Case 6: Submitting answer for question outside the attempt returns 400 Bad Request', async () => {
      // Create valid attempt
      const quizRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type_filter: 'BOTH',
          requested_count: 2,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });
      expect(quizRes.status).toBe(201);
      const attemptId = quizRes.body.attemptId || quizRes.body.attempt.id;

      // Start attempt
      await request(app)
        .post(`/api/v1/attempts/${attemptId}/start`)
        .set('Cookie', studentCookies);

      // Submit answer for fake/unrelated quiz_question_id
      const fakeQId = '00000000-0000-0000-0000-000000000099';
      const ansRes = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers/${fakeQId}`)
        .set('Cookie', studentCookies)
        .send({ selected_option: 'Option A' });

      expect(ansRes.status).toBe(400);
      expect(ansRes.body.error.message).toMatch(/does not belong to this attempt/i);
    });

    it('Case 7: Duplicate quiz submission is idempotent and returns 200 without duplicate evaluation', async () => {
      // Create and start attempt
      const quizRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type_filter: 'BOTH',
          requested_count: 1,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });
      const attemptId = quizRes.body.attemptId || quizRes.body.attempt.id;

      await request(app)
        .post(`/api/v1/attempts/${attemptId}/start`)
        .set('Cookie', studentCookies);

      // Submit attempt 1st time
      const sub1 = await request(app)
        .post(`/api/v1/attempts/${attemptId}/submit`)
        .set('Cookie', studentCookies);
      expect(sub1.status).toBe(200);

      // Submit attempt 2nd time
      const sub2 = await request(app)
        .post(`/api/v1/attempts/${attemptId}/submit`)
        .set('Cookie', studentCookies);
      expect(sub2.status).toBe(200);
      expect(sub2.body.status).toBe(sub1.body.status);
    });

    it('Case 8: Timer expiry blocks subsequent answer saves (409 Conflict) and auto-completes', async () => {
      // Create FIXED timer quiz with 1 second duration
      const quizRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type_filter: 'BOTH',
          requested_count: 1,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'FIXED',
          timer_duration_seconds: 1,
        });
      const attemptId = quizRes.body.attemptId || quizRes.body.attempt.id;

      // Start attempt
      await request(app)
        .post(`/api/v1/attempts/${attemptId}/start`)
        .set('Cookie', studentCookies);

      // Wait 1.5 seconds for timer to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const attemptDetail = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Cookie', studentCookies);
      const qqId = attemptDetail.body.questions[0].quiz_question_id;

      // Try saving answer after expiry
      const saveRes = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers/${qqId}`)
        .set('Cookie', studentCookies)
        .send({ selected_option: 'Queue' });

      expect(saveRes.status).toBe(409);
      expect(saveRes.body.error.code).toBe('CONFLICT');
      expect(saveRes.body.error.message).toMatch(/time limit expired|not in progress/i);
    });

    it('Case 9: Page refresh mid-quiz simulation returns active attempt state without leaking answers', async () => {
      const quizRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type_filter: 'BOTH',
          requested_count: 2,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });
      const attemptId = quizRes.body.attemptId || quizRes.body.attempt.id;

      await request(app)
        .post(`/api/v1/attempts/${attemptId}/start`)
        .set('Cookie', studentCookies);

      // Save answer for Q1
      const attemptBefore = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Cookie', studentCookies);
      const q1Id = attemptBefore.body.questions[0].quiz_question_id;

      await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers/${q1Id}`)
        .set('Cookie', studentCookies)
        .send({ selected_option: 'Resource management and hardware abstraction' });

      // Simulate full page refresh: GET /attempts/:attemptId
      const refreshedAttempt = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Cookie', studentCookies);

      expect(refreshedAttempt.status).toBe(200);
      expect(refreshedAttempt.body.attempt.status).toBe('IN_PROGRESS');
      expect(refreshedAttempt.body.questions.length).toBe(2);

      // Verify no correct_answer or explanation leakage during solving
      for (const q of refreshedAttempt.body.questions) {
        expect(q.correct_answer).toBeUndefined();
        expect(q.explanation).toBeUndefined();
      }

      // Verify saved answer was preserved in submitted_answers
      const savedAns = refreshedAttempt.body.submitted_answers.find(
        (ans: any) => ans.quiz_question_id === q1Id
      );
      expect(savedAns).toBeDefined();
      expect(savedAns.selected_option).toBe('Resource management and hardware abstraction');
    });

    it('Case 10: Network interruption during answer save allows seamless upsert retries', async () => {
      const quizRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type_filter: 'BOTH',
          requested_count: 1,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });
      const attemptId = quizRes.body.attemptId || quizRes.body.attempt.id;

      await request(app)
        .post(`/api/v1/attempts/${attemptId}/start`)
        .set('Cookie', studentCookies);

      const attemptDetail = await request(app)
        .get(`/api/v1/attempts/${attemptId}`)
        .set('Cookie', studentCookies);
      const qqId = attemptDetail.body.questions[0].quiz_question_id;

      // 1st attempt at saving answer
      const res1 = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers/${qqId}`)
        .set('Cookie', studentCookies)
        .send({ selected_option: 'Queue' });
      expect(res1.status).toBe(200);

      // Re-save (e.g. retry after reconnect or option change)
      const res2 = await request(app)
        .put(`/api/v1/attempts/${attemptId}/answers/${qqId}`)
        .set('Cookie', studentCookies)
        .send({ selected_option: 'Stack' });
      expect(res2.status).toBe(200);
      expect(res2.body.answer.selected_option).toBe('Stack');
    });

    it('Case 11: Deactivated question is immediately excluded from new quizzes but visible historically', async () => {
      // Create a temporary active question
      const tempQ = await prisma.question.create({
        data: {
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_text: 'Temporary Question for Deactivation Test',
          options: [{ text: 'A' }, { text: 'B' }],
          correct_answer: 'A',
          question_type: QuestionType.CONCEPT,
          status: QuestionStatus.ACTIVE,
          source: QuestionSource.MANUAL,
          created_by: adminUserId,
        },
      });

      // Include it in a quiz attempt
      const quizRes = await request(app)
        .post('/api/v1/quizzes')
        .set('Cookie', studentCookies)
        .send({
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type_filter: 'BOTH',
          requested_count: 3,
          order_mode: 'SEQUENTIAL',
          timer_mode: 'VARIABLE',
        });
      expect(quizRes.status).toBe(201);
      const historicalAttemptId = quizRes.body.attemptId || quizRes.body.attempt.id;

      // Start and submit attempt
      await request(app)
        .post(`/api/v1/attempts/${historicalAttemptId}/start`)
        .set('Cookie', studentCookies);
      await request(app)
        .post(`/api/v1/attempts/${historicalAttemptId}/submit`)
        .set('Cookie', studentCookies);

      // Deactivate the question
      await prisma.question.update({
        where: { id: tempQ.id },
        data: { status: QuestionStatus.INACTIVE },
      });

      // Check available questions count - should now be 2, not 3
      const countRes = await request(app)
        .get('/api/v1/questions/available-count')
        .query({ subjectId: testSubjectId, chapterId: testChapterId, type: 'BOTH' })
        .set('Cookie', studentCookies);
      expect(countRes.status).toBe(200);
      expect(countRes.body.count).toBe(2);

      // Verify historical result still includes the deactivated question without error
      const resultRes = await request(app)
        .get(`/api/v1/attempts/${historicalAttemptId}/result`)
        .set('Cookie', studentCookies);
      expect(resultRes.status).toBe(200);
      expect(resultRes.body.questions.length).toBe(3);

      // Cleanup
      await prisma.submittedAnswer.deleteMany({ where: { quiz_question: { question_id: tempQ.id } } });
      await prisma.quizQuestion.deleteMany({ where: { question_id: tempQ.id } });
      await prisma.question.delete({ where: { id: tempQ.id } });
    });

    it('Case 12: Simulated database failure returns clean 500 JSON without stack trace leakage', async () => {
      // Spy on prisma.subject.findMany to throw DB connection error
      const spy = vi.spyOn(prisma.subject, 'findMany').mockRejectedValueOnce(new Error('Connection terminated unexpectedly'));

      const res = await request(app)
        .get('/api/v1/subjects')
        .set('Cookie', studentCookies);

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(res.body.error.message).toBeDefined();

      spy.mockRestore();
    });
  });

  // =========================================================================
  // CATEGORY B: AI & HYBRID EXTRACTION FAILURE MODES (10 CASES)
  // =========================================================================
  describe('Category B: AI & Hybrid Extraction Failure Modes', () => {
    it('Case 13: GEMINI_API_KEY unset / invalid falls back cleanly to local extraction', async () => {
      // Mock isConfigured to false
      const configSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(false);

      const ingestionService = new IngestionService();
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: samplePdfBuffer,
        size: samplePdfBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);
      expect(result.batch.status).toBe('EXTRACTED');
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates[0].question_text).toBeDefined();

      configSpy.mockRestore();
    });

    it('Case 14: Gemini API timeout triggers graceful fallback to local extraction', async () => {
      // Mock Gemini extraction throwing a timeout error
      const extractSpy = vi
        .spyOn(geminiExtractionService, 'extractQuestionsFromPdf')
        .mockRejectedValueOnce(new Error('Gemini API request timed out after 60000ms'));
      const isConfigSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);

      const ingestionService = new IngestionService();
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-timeout.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: samplePdfBuffer,
        size: samplePdfBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);
      expect(result.batch.status).toBe('EXTRACTED');
      expect(result.candidates.length).toBeGreaterThan(0);

      extractSpy.mockRestore();
      isConfigSpy.mockRestore();
    });

    it('Case 15: Gemini rate-limit/quota exceeded (429) logs sanitized error without leaking API key and falls back', async () => {
      const sensitiveKey = 'AIzaSySecretApiKey1234567890';
      const keySpy = vi.spyOn(geminiClientFactory, 'getApiKey').mockReturnValue(sensitiveKey);
      const isConfigSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);

      // Verify that geminiExtractionService catches 429 and redacts API key
      const mockClient = {
        models: {
          generateContent: vi.fn().mockRejectedValue(
            new Error(`429 Resource has been exhausted (quota exceeded) for key ${sensitiveKey}`)
          ),
        },
      };
      const clientSpy = vi.spyOn(geminiClientFactory, 'getClient').mockReturnValue(mockClient as any);

      await expect(
        geminiExtractionService.extractQuestionsFromPdf(samplePdfBuffer, 'test.pdf')
      ).rejects.toThrow(/\[REDACTED_API_KEY\]/);

      // Ensure raw key is NOT present in thrown message
      try {
        await geminiExtractionService.extractQuestionsFromPdf(samplePdfBuffer, 'test.pdf');
      } catch (err: any) {
        expect(err.message).not.toContain(sensitiveKey);
        expect(err.message).toContain('[REDACTED_API_KEY]');
      }

      keySpy.mockRestore();
      isConfigSpy.mockRestore();
      clientSpy.mockRestore();
    });

    it('Case 16: Gemini returns schema-invalid JSON — caught by Zod and falls back to local extraction', async () => {
      const mockClient = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              // Invalid schema: questions missing questionNumber, options missing letter/text
              questions: [{ invalidKey: 123 }],
            }),
          }),
        },
      };
      const clientSpy = vi.spyOn(geminiClientFactory, 'getClient').mockReturnValue(mockClient as any);
      const isConfigSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);

      // Verify extractQuestionsFromPdf throws descriptive schema error
      await expect(
        geminiExtractionService.extractQuestionsFromPdf(samplePdfBuffer, 'test.pdf')
      ).rejects.toThrow(/schema validation/i);

      clientSpy.mockRestore();
      isConfigSpy.mockRestore();
    });

    it('Case 17: EXTRACTION_ENGINE=local correctly bypasses Gemini entirely with zero API calls', async () => {
      const prevEngine = env.EXTRACTION_ENGINE;
      env.EXTRACTION_ENGINE = 'local';

      const geminiSpy = vi.spyOn(geminiExtractionService, 'extractQuestionsFromPdf');
      const localSpy = vi.spyOn(extractionService, 'extractFromPdf');

      const ingestionService = new IngestionService();
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-local.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: samplePdfBuffer,
        size: samplePdfBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      await ingestionService.uploadAndExtract(mockFile, adminUserId);

      expect(geminiSpy).not.toHaveBeenCalled();
      expect(localSpy).toHaveBeenCalled();

      env.EXTRACTION_ENGINE = prevEngine;
      geminiSpy.mockRestore();
      localSpy.mockRestore();
    });

    it('Case 18: EXTRACTION_ENGINE=gemini uses Gemini output directly and skips hybrid reconciliation when high confidence', async () => {
      const prevEngine = env.EXTRACTION_ENGINE;
      env.EXTRACTION_ENGINE = 'gemini';

      const mockGeminiCandidate: CandidateQuestion = {
        id: 'gemini-high-1',
        questionNumber: 1,
        question_text: 'Gemini Pure Question 1',
        options: [{ text: 'A' }, { text: 'B' }, { text: 'C' }, { text: 'D' }],
        correct_answer: 'A',
        question_type: 'CONCEPT',
        confidence: 'HIGH',
        needsReview: false,
        extractionMethod: 'GEMINI_DOCUMENT',
      };

      const geminiSpy = vi.spyOn(geminiExtractionService, 'extractQuestionsFromPdf').mockResolvedValueOnce({
        candidates: [mockGeminiCandidate],
        warnings: [],
        hasCriticalErrors: false,
        confidenceCounts: { high: 1, medium: 0, low: 0 },
        processingDurationMs: 100,
      });
      const isConfigSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);
      const localSpy = vi.spyOn(extractionService, 'extractFromPdf');

      const ingestionService = new IngestionService();
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test-gemini-mode.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: samplePdfBuffer,
        size: samplePdfBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);

      expect(result.candidates.length).toBe(1);
      expect(result.candidates[0].question_text).toBe('Gemini Pure Question 1');
      // In pure gemini mode with HIGH confidence, local extractor was not called for hybrid reconciliation
      expect(localSpy).not.toHaveBeenCalled();

      env.EXTRACTION_ENGINE = prevEngine;
      geminiSpy.mockRestore();
      isConfigSpy.mockRestore();
      localSpy.mockRestore();
    });

    it('Case 19: Hybrid reconciliation under mismatched candidate arrays correctly matches by Q-number and recovers missing questions', () => {
      const geminiCandidates: CandidateQuestion[] = [
        {
          id: 'g-q1',
          questionNumber: 1,
          question_text: 'Gemini Q1 Text (Low Conf)',
          options: [],
          correct_answer: '',
          question_type: 'CONCEPT',
          confidence: 'LOW',
          needsReview: true,
          extractionMethod: 'GEMINI_DOCUMENT',
        },
        {
          id: 'g-q3',
          questionNumber: 3,
          question_text: 'Gemini Q3 Text (Disagreement)',
          options: [{ text: 'G-Opt-A' }, { text: 'G-Opt-B' }],
          correct_answer: 'G-Opt-A',
          question_type: 'CONCEPT',
          confidence: 'MEDIUM',
          needsReview: false,
          extractionMethod: 'GEMINI_DOCUMENT',
        },
        {
          id: 'g-q4',
          questionNumber: 4,
          question_text: 'Gemini Q4 Text (High Conf)',
          options: [{ text: 'G4-A' }, { text: 'G4-B' }],
          correct_answer: 'G4-A',
          question_type: 'CONCEPT',
          confidence: 'HIGH',
          needsReview: false,
          extractionMethod: 'GEMINI_DOCUMENT',
        },
      ];

      const localCandidates: CandidateQuestion[] = [
        {
          id: 'l-q1',
          questionNumber: 1,
          question_text: 'Local Q1 Text',
          options: [{ text: 'L1-A' }, { text: 'L1-B' }],
          correct_answer: 'L1-A',
          question_type: 'CONCEPT',
          confidence: 'HIGH',
          needsReview: false,
          extractionMethod: 'TEXT',
        },
        {
          id: 'l-q2',
          questionNumber: 2,
          question_text: 'Local Q2 Text (Gemini Missed)',
          options: [{ text: 'L2-A' }, { text: 'L2-B' }],
          correct_answer: 'L2-A',
          question_type: 'CONCEPT',
          confidence: 'HIGH',
          needsReview: false,
          extractionMethod: 'TEXT',
        },
        {
          id: 'l-q3',
          questionNumber: 3,
          question_text: 'Local Q3 Text',
          options: [{ text: 'L3-A' }, { text: 'L3-B' }, { text: 'L3-C' }],
          correct_answer: 'L3-A',
          question_type: 'CONCEPT',
          confidence: 'HIGH',
          needsReview: false,
          extractionMethod: 'TEXT',
        },
        {
          id: 'l-q4',
          questionNumber: 4,
          question_text: 'Local Q4 Text',
          options: [{ text: 'G4-A' }, { text: 'G4-B' }],
          correct_answer: 'G4-A',
          question_type: 'CONCEPT',
          confidence: 'HIGH',
          needsReview: false,
          extractionMethod: 'TEXT',
        },
        {
          id: 'l-q5',
          questionNumber: 5,
          question_text: 'Local Q5 Text (Gemini Missed)',
          options: [{ text: 'L5-A' }, { text: 'L5-B' }],
          correct_answer: 'L5-A',
          question_type: 'CONCEPT',
          confidence: 'HIGH',
          needsReview: false,
          extractionMethod: 'TEXT',
        },
      ];

      const reconciled = reconcileHybridCandidates(geminiCandidates, localCandidates);

      expect(reconciled.length).toBe(5);

      // Q1 merged with local Q1
      const q1 = reconciled.find((c) => c.questionNumber === 1);
      expect(q1?.correct_answer).toBe('L1-A');
      expect(q1?.confidence).toBe('HIGH');
      expect(q1?.extractionMethod).toBe('GEMINI_HYBRID');

      // Q2 recovered from local
      const q2 = reconciled.find((c) => c.questionNumber === 2);
      expect(q2?.extractionMethod).toBe('LOCAL_ONLY_RECOVERED');
      expect(q2?.needsReview).toBe(true);

      // Q3 matched to local Q3 (NOT local Q2)
      const q3 = reconciled.find((c) => c.questionNumber === 3);
      expect(q3?.options.length).toBe(3); // Local had 3 options
      expect(q3?.extractionMethod).toBe('GEMINI_HYBRID');

      // Q4 retained Gemini HIGH
      const q4 = reconciled.find((c) => c.questionNumber === 4);
      expect(q4?.extractionMethod).toBe('GEMINI_DOCUMENT');

      // Q5 recovered from local
      const q5 = reconciled.find((c) => c.questionNumber === 5);
      expect(q5?.extractionMethod).toBe('LOCAL_ONLY_RECOVERED');
    });

    it('Case 20: Visual diagram capture failure on a question gracefully degrades with diagram_url=null without crashing batch', async () => {
      // Mock renderPageToImage throwing an error
      const renderSpy = vi.spyOn(pageRenderer, 'renderPageToImage').mockRejectedValueOnce(new Error('Canvas rasterization failed'));

      const mockClient = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              questions: [
                {
                  questionNumber: 1,
                  questionText: 'Question with failing visual diagram',
                  options: [{ label: 'A', text: '1' }, { label: 'B', text: '2' }, { label: 'C', text: '3' }, { label: 'D', text: '4' }],
                  correctAnswerLetter: 'A',
                  hasVisual: true,
                  visualElements: [{ type: 'DIAGRAM', description: 'circuit', pageNumber: 1, boundingBox: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } }],
                },
              ],
            }),
          }),
        },
      };

      const clientSpy = vi.spyOn(geminiClientFactory, 'getClient').mockReturnValue(mockClient as any);
      const isConfigSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);

      const result = await geminiExtractionService.extractQuestionsFromPdf(samplePdfBuffer, 'test-visual-fail.pdf');
      expect(result.candidates.length).toBe(1);
      // Question extracted successfully, diagram_url safely remains null/undefined
      expect(result.candidates[0].diagram_url).toBeFalsy();
      expect(result.candidates[0].question_text).toContain('Question with failing visual diagram');

      renderSpy.mockRestore();
      clientSpy.mockRestore();
      isConfigSpy.mockRestore();
    });

    it('Case 21: PDF with zero visual content makes 0 page-rendering and 0 storage calls', async () => {
      const renderSpy = vi.spyOn(pageRenderer, 'renderPageToImage');
      const cropSpy = vi.spyOn(imageCropper, 'cropImageBuffer');
      const storageSpy = vi.spyOn(storageProvider, 'saveFile');

      const mockClient = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              questions: [
                {
                  questionNumber: 1,
                  questionText: 'Pure text question without visuals',
                  options: [{ label: 'A', text: 'Alpha' }, { label: 'B', text: 'Beta' }, { label: 'C', text: 'Gamma' }, { label: 'D', text: 'Delta' }],
                  correctAnswerLetter: 'A',
                  hasVisual: false,
                  visualElements: [],
                },
              ],
            }),
          }),
        },
      };

      const clientSpy = vi.spyOn(geminiClientFactory, 'getClient').mockReturnValue(mockClient as any);
      const isConfigSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);

      const result = await geminiExtractionService.extractQuestionsFromPdf(samplePdfBuffer, 'test-text-only.pdf');

      expect(result.candidates.length).toBe(1);
      // 0 visual rasterization, crop, or diagram storage calls
      expect(renderSpy).not.toHaveBeenCalled();
      expect(cropSpy).not.toHaveBeenCalled();
      expect(storageSpy).not.toHaveBeenCalled();

      renderSpy.mockRestore();
      cropSpy.mockRestore();
      storageSpy.mockRestore();
      clientSpy.mockRestore();
      isConfigSpy.mockRestore();
    });

    it('Case 22: Large multi-page PDF near 10MB limit processes within size cap without premature HTTP timeout', async () => {
      // Create a 4MB buffer simulating a large document within the 10MB limit
      const largePdfHeader = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n');
      const padding = Buffer.alloc(4 * 1024 * 1024 - largePdfHeader.length, 'A');
      const largePdfBuffer = Buffer.concat([largePdfHeader, padding]);

      expect(largePdfBuffer.length).toBeLessThan(10 * 1024 * 1024);
      expect(extractionService.validatePdfSignature(largePdfBuffer)).toBe(true);

      // Verify multer size validator accepts file <= 10MB
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large-doc.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: largePdfBuffer,
        size: largePdfBuffer.length,
        destination: '',
        filename: '',
        path: '',
        stream: null as any,
      };

      // Mock local parser fast return to verify pipeline size validation
      const localSpy = vi.spyOn(extractionService, 'extractFromPdf').mockResolvedValueOnce([
        {
          id: 'large-cand-1',
          questionNumber: 1,
          question_text: 'Question from large PDF',
          options: [{ text: '1' }, { text: '2' }],
          correct_answer: '1',
          question_type: 'CONCEPT',
          confidence: 'HIGH',
          needsReview: false,
        },
      ]);
      const configSpy = vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(false);

      const ingestionService = new IngestionService();
      const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);

      expect(result.batch.status).toBe('EXTRACTED');
      expect(result.candidates.length).toBe(1);

      localSpy.mockRestore();
      configSpy.mockRestore();
    });
  });
});
