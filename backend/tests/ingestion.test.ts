import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import {
  extractionService,
  detectSectionBoundary,
  splitHeaderAndStem,
  parseOptions,
  cleanWatermarks,
  DEFAULT_WATERMARK_PATTERNS,
} from '../src/modules/ingestion/extraction.service.js';

let adminCookies: string[] = [];
let studentCookies: string[] = [];
let testSubjectId: string;
let testChapterId: string;
const createdBatchIds: string[] = [];
const createdQuestionIds: string[] = [];

// Sample minimal valid PDF buffer
const validPdfBuffer = Buffer.from(
  '%PDF-1.4\n' +
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\n' +
    'xref\n' +
    '0 4\n' +
    '0000000000 65535 f \n' +
    '0000000009 00000 n \n' +
    '0000000052 00000 n \n' +
    '0000000101 00000 n \n' +
    'trailer<</Size 4/Root 1 0 R>>\n' +
    'startxref\n' +
    '178\n' +
    '%%EOF'
);

beforeAll(async () => {
  // Get active subject and chapter for foreign key assignment
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

  // Student login
  const studentRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'student@examprep.dev', password: 'StudentDev123!' });
  studentCookies = studentRes.headers['set-cookie'] as unknown as string[];
});

afterAll(async () => {
  if (createdQuestionIds.length > 0) {
    await prisma.question.deleteMany({ where: { id: { in: createdQuestionIds } } }).catch(() => {});
  }
  if (createdBatchIds.length > 0) {
    await prisma.ingestionBatch.deleteMany({ where: { id: { in: createdBatchIds } } }).catch(() => {});
  }
  await prisma.$disconnect();
});

describe('PDF Ingestion Backend (PROMPT 14)', () => {
  describe('POST /api/v1/ingestion/upload Security & Validation', () => {
    it('should reject unauthenticated upload requests with 401', async () => {
      const res = await request(app)
        .post('/api/v1/ingestion/upload')
        .attach('file', validPdfBuffer, 'test.pdf');
      expect(res.status).toBe(401);
    });

    it('should forbid non-admin students from uploading PDFs with 403', async () => {
      const res = await request(app)
        .post('/api/v1/ingestion/upload')
        .set('Cookie', studentCookies)
        .attach('file', validPdfBuffer, 'test.pdf');
      expect(res.status).toBe(403);
    });

    it('should reject upload requests without any file attached (400)', async () => {
      const res = await request(app)
        .post('/api/v1/ingestion/upload')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid file types / wrong magic header with 400', async () => {
      const fakePdf = Buffer.from('This is definitely a plain text file, not a PDF');
      const res = await request(app)
        .post('/api/v1/ingestion/upload')
        .set('Cookie', adminCookies)
        .attach('file', fakePdf, { filename: 'test.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/signature/i);
    });

    it('should reject empty files (0 bytes) with 400', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const res = await request(app)
        .post('/api/v1/ingestion/upload')
        .set('Cookie', adminCookies)
        .attach('file', emptyBuffer, { filename: 'empty.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/empty/i);
    });
  });

  describe('Upload & Extraction Pipeline', () => {
    it('should handle corrupted or unextractable PDF gracefully with FAILED status and clear message', async () => {
      // Buffer with PDF header but corrupted body
      const corruptedPdf = Buffer.from('%PDF-1.4\nCorrupted content without catalog or xref table');
      const res = await request(app)
        .post('/api/v1/ingestion/upload')
        .set('Cookie', adminCookies)
        .attach('file', corruptedPdf, { filename: 'corrupted.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.batch).toBeDefined();
      expect(res.body.batch.status).toBe('FAILED');
      expect(res.body.batch.error_message).toBeDefined();
      expect(res.body.candidates).toEqual([]);
      createdBatchIds.push(res.body.batch.id);
    });

    it('should successfully upload a valid PDF, extract text, and return structured candidate questions', async () => {
      // Mock extractTextFromPdf to return realistic exam quiz questions text
      const mockExamText = `
1. What is the worst-case time complexity of quicksort?
(A) O(n log n)
(B) O(n^2)
(C) O(n)
(D) O(1)
Answer: B
Explanation: Quicksort degrades to O(n^2) when poor pivots are repeatedly chosen.

2. Which scheduling algorithm can lead to starvation? [GATE 2020]
(A) First-Come, First-Served (FCFS)
(B) Round Robin (RR)
(C) Shortest Job First (SJF)
(D) Earliest Deadline First
Ans: C
Explanation: Long processes can starve in SJF if short processes continually arrive.
      `;

      const extractSpy = vi
        .spyOn(extractionService, 'extractTextFromPdf')
        .mockResolvedValueOnce(mockExamText);

      const res = await request(app)
        .post('/api/v1/ingestion/upload')
        .set('Cookie', adminCookies)
        .attach('file', validPdfBuffer, { filename: 'exam_sample.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect(res.body.batch).toBeDefined();
      expect(res.body.batch.status).toBe('EXTRACTED');
      expect(res.body.batch.source_type).toBe('PDF');
      expect(res.body.batch.storage_key).toBeDefined();

      const candidates = res.body.candidates;
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBe(2);

      // Question 1 assertions
      expect(candidates[0].question_text).toContain('worst-case time complexity of quicksort');
      expect(candidates[0].options.length).toBe(4);
      expect(candidates[0].correct_answer).toBe('O(n^2)');
      expect(candidates[0].explanation).toContain('Quicksort degrades');
      expect(candidates[0].question_type).toBe('CONCEPT');
      expect(candidates[0].needsReview).toBe(false);

      // Question 2 (PYQ) assertions
      expect(candidates[1].question_text).toContain('scheduling algorithm can lead to starvation');
      expect(candidates[1].question_type).toBe('PYQ');
      expect(candidates[1].exam_name).toBe('GATE');
      expect(candidates[1].exam_year).toBe(2020);
      expect(candidates[1].correct_answer).toContain('Shortest Job First');

      createdBatchIds.push(res.body.batch.id);
      extractSpy.mockRestore();
    });
  });

  describe('GET /api/v1/ingestion/:batchId', () => {
    it('should return 404 for a non-existent batch ID', async () => {
      const res = await request(app)
        .get('/api/v1/ingestion/00000000-0000-0000-0000-000000000999')
        .set('Cookie', adminCookies);
      expect(res.status).toBe(404);
    });

    it('should return batch details and candidate list for an existing batch', async () => {
      const batch = await prisma.ingestionBatch.create({
        data: {
          uploaded_by: '00000000-0000-0000-0000-000000000001',
          source_type: 'PDF',
          original_filename: 'existing.pdf',
          status: 'EXTRACTED',
        },
      });
      createdBatchIds.push(batch.id);

      const res = await request(app)
        .get(`/api/v1/ingestion/${batch.id}`)
        .set('Cookie', adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.batch.id).toBe(batch.id);
      expect(res.body.batch.status).toBe('EXTRACTED');
      expect(Array.isArray(res.body.candidates)).toBe(true);
    });
  });

  describe('POST /api/v1/ingestion/:batchId/questions (Review & Persist)', () => {
    it('should reject submission with mismatched correct_answer (422)', async () => {
      const batch = await prisma.ingestionBatch.create({
        data: {
          uploaded_by: '00000000-0000-0000-0000-000000000001',
          source_type: 'PDF',
          original_filename: 'batch_test.pdf',
          status: 'EXTRACTED',
        },
      });
      createdBatchIds.push(batch.id);

      const res = await request(app)
        .post(`/api/v1/ingestion/${batch.id}/questions`)
        .set('Cookie', adminCookies)
        .send({
          questions: [
            {
              question_text: 'Invalid answer question',
              options: [{ text: 'Choice 1' }, { text: 'Choice 2' }],
              correct_answer: 'Choice 3 which does not exist',
              subject_id: testSubjectId,
              chapter_id: testChapterId,
              question_type: 'CONCEPT',
            },
          ],
        });

      expect(res.status).toBe(422);
    });

    it('should successfully persist reviewed candidates as real Question rows and update batch to REVIEWED', async () => {
      const batch = await prisma.ingestionBatch.create({
        data: {
          uploaded_by: '00000000-0000-0000-0000-000000000001',
          source_type: 'PDF',
          original_filename: 'batch_to_persist.pdf',
          status: 'EXTRACTED',
        },
      });
      createdBatchIds.push(batch.id);

      const reviewedQuestions = [
        {
          question_text: 'What does ACID stand for in DBMS?',
          options: [
            { text: 'Atomicity, Consistency, Isolation, Durability' },
            { text: 'Accuracy, Completeness, Integrity, Durability' },
          ],
          correct_answer: 'Atomicity, Consistency, Isolation, Durability',
          explanation: 'ACID properties ensure reliable database transaction processing.',
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type: 'CONCEPT',
          status: 'DRAFT',
        },
        {
          question_text: 'Consider a paging system with page size 4KB. [GATE 2022]',
          options: [
            { text: '12 bits for offset' },
            { text: '10 bits for offset' },
          ],
          correct_answer: '12 bits for offset',
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type: 'PYQ',
          exam_name: 'GATE CS',
          exam_year: 2022,
          status: 'DRAFT',
        },
      ];

      const res = await request(app)
        .post(`/api/v1/ingestion/${batch.id}/questions`)
        .set('Cookie', adminCookies)
        .send({ questions: reviewedQuestions });

      expect(res.status).toBe(201);
      expect(res.body.createdCount).toBe(2);
      expect(res.body.batch.status).toBe('REVIEWED');

      // Verify questions exist in DB with source=PDF and ingestion_batch_id set
      const createdQuestions = res.body.questions;
      for (const q of createdQuestions) {
        createdQuestionIds.push(q.id);
        const inDb = await prisma.question.findUnique({ where: { id: q.id } });
        expect(inDb).toBeDefined();
        expect(inDb?.source).toBe('PDF');
        expect(inDb?.ingestion_batch_id).toBe(batch.id);
        expect(inDb?.status).toBe('DRAFT');
      }

      // Verify second submission on already-reviewed batch is rejected (409)
      const repeatRes = await request(app)
        .post(`/api/v1/ingestion/${batch.id}/questions`)
        .set('Cookie', adminCookies)
        .send({ questions: reviewedQuestions });
      expect(repeatRes.status).toBe(409);
    });

    it('should persist diagram_url and extraction_metadata when provided in reviewed items (PROMPT 7)', async () => {
      const batch = await prisma.ingestionBatch.create({
        data: {
          uploaded_by: '00000000-0000-0000-0000-000000000001',
          source_type: 'PDF',
          original_filename: 'batch_metadata_test.pdf',
          status: 'EXTRACTED',
        },
      });
      createdBatchIds.push(batch.id);

      const reviewedQuestions = [
        {
          question_text: 'Question with diagram and metadata',
          options: [{ text: 'Opt A' }, { text: 'Opt B' }],
          correct_answer: 'Opt A',
          subject_id: testSubjectId,
          chapter_id: testChapterId,
          question_type: 'CONCEPT',
          status: 'ACTIVE',
          diagram_url:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          confidence: 'HIGH',
          sourcePages: [1],
          extractionMethod: 'TEXT_PLUS_VISION',
          reviewReason: null,
        },
      ];

      const res = await request(app)
        .post(`/api/v1/ingestion/${batch.id}/questions`)
        .set('Cookie', adminCookies)
        .send({ questions: reviewedQuestions });

      expect(res.status).toBe(201);
      const createdId = res.body.questions[0].id;
      createdQuestionIds.push(createdId);

      const inDb = await prisma.question.findUnique({ where: { id: createdId } });
      expect(inDb).toBeDefined();
      expect(inDb?.diagram_url).toMatch(/^\/uploads\/[0-9a-fA-F-]+\.png$/);
      expect(inDb?.extraction_metadata).toEqual({
        confidence: 'HIGH',
        sourcePages: [1],
        extractionMethod: 'TEXT_PLUS_VISION',
        reviewReason: null,
      });
    });
  });

  describe('PDF Extraction Fixes (PROMPT 26)', () => {
    describe('1. Section-boundary detector (detectSectionBoundary)', () => {
      it('should identify the offset where ANSWERS AND SOLUTIONS starts and exclude it from questionsText', () => {
        const rawText = `Q1. JEE Main 2026\nA body of mass 2 kg...\n(1) 12 (2) 49 (3) 42 (4) 24\n\nANSWERS AND SOLUTIONS\n1. (4) Given m = 2 kg... Bob A swings from to vertical...`;
        const result = detectSectionBoundary(rawText);

        expect(result.boundaryOffset).toBeGreaterThan(0);
        expect(result.questionsText).toContain('Q1. JEE Main 2026');
        expect(result.questionsText).toContain('(1) 12 (2) 49 (3) 42 (4) 24');
        expect(result.questionsText).not.toContain('ANSWERS AND SOLUTIONS');
        expect(result.questionsText).not.toContain('Bob A swings');

        expect(result.solutionsText).toBeDefined();
        expect(result.solutionsText).toContain('ANSWERS AND SOLUTIONS');
        expect(result.solutionsText).toContain('Bob A swings from to vertical');
      });

      it('should recognize various case-insensitive solution headings (Answer Key, Solutions, etc.)', () => {
        const headings = ['answer key', 'Solutions & Explanations', 'HINTS AND SOLUTIONS'];
        for (const heading of headings) {
          const sample = `Q1. Sample question stem\n\n${heading}\n1. (A) Solution details`;
          const result = detectSectionBoundary(sample);
          expect(result.boundaryOffset).toBeGreaterThan(0);
          expect(result.questionsText).toBe('Q1. Sample question stem');
          expect(result.solutionsText).toContain(heading);
        }
      });

      it('should return null solutionsText when no solution heading is present', () => {
        const pureQuestions = `Q1. First question\n(A) 1 (B) 2\n\nQ2. Second question\n(A) 3 (B) 4`;
        const result = detectSectionBoundary(pureQuestions);
        expect(result.boundaryOffset).toBeNull();
        expect(result.solutionsText).toBeNull();
        expect(result.questionsText).toBe(pureQuestions);
      });
    });

    describe('2. Question header vs. stem separation (splitHeaderAndStem)', () => {
      it('should separate exam header/metadata from actual question stem for Q1 sample', () => {
        const block = `Q1. JEE Main 2026 (21 January Shift 2)\nA body of mass 2 kg is moving along -direction such that its displacement as function of time is given by\n(1) 12 (2) 49 (3) 42 (4) 24`;
        const result = splitHeaderAndStem(block);

        expect(result.questionNumber).toBe(1);
        expect(result.headerLine).toBe('JEE Main 2026 (21 January Shift 2)');
        expect(result.examName).toBe('JEE Main 2026 (21 January Shift 2)');
        expect(result.examYear).toBe(2026);
        expect(result.stemText).toContain('A body of mass 2 kg is moving along');
        expect(result.stemText).not.toContain('JEE Main 2026');
      });

      it('should preserve stem without dedicated header line for standard numbered questions', () => {
        const block = `1. What is the worst-case time complexity of quicksort?\n(A) O(n log n)\n(B) O(n^2)`;
        const result = splitHeaderAndStem(block);

        expect(result.questionNumber).toBe(1);
        expect(result.headerLine).toBeNull();
        expect(result.stemText).toContain('What is the worst-case time complexity of quicksort?');
      });
    });

    describe('3. Options parser (parseOptions)', () => {
      it('should correctly parse inline single-line numbered options into 4 choices', () => {
        const inlineRaw = `(1) 12  (2) 49  (3) 42  (4) 24`;
        const options = parseOptions(inlineRaw);

        expect(options.length).toBe(4);
        expect(options.map((o) => o.text)).toEqual(['12', '49', '42', '24']);
        expect(options[0].letter).toBe('A');
        expect(options[1].letter).toBe('B');
        expect(options[2].letter).toBe('C');
        expect(options[3].letter).toBe('D');
      });

      it('should correctly parse inline tab-separated options', () => {
        const tabSeparated = `(1) 12 \t(2) 49 \t(3) 42 \t(4) 24`;
        const options = parseOptions(tabSeparated);

        expect(options.length).toBe(4);
        expect(options.map((o) => o.text)).toEqual(['12', '49', '42', '24']);
      });

      it('should correctly parse stacked multi-line options', () => {
        const stackedRaw = `(1) Both Statement I and Statement II are false\n(2) Statement I is false but Statement II is true\n(3) Statement I is true but Statement II is false\n(4) Both Statement I and Statement II are true`;
        const options = parseOptions(stackedRaw);

        expect(options.length).toBe(4);
        expect(options[0].text).toBe('Both Statement I and Statement II are false');
        expect(options[1].text).toBe('Statement I is false but Statement II is true');
        expect(options[2].text).toBe('Statement I is true but Statement II is false');
        expect(options[3].text).toBe('Both Statement I and Statement II are true');
      });

      it('should correctly parse lettered options (A), (B), (C), (D) and dotted formats A., B., C., D.', () => {
        const letterDotted = `A. First choice\nB. Second choice\nC. Third choice\nD. Fourth choice`;
        const options = parseOptions(letterDotted);

        expect(options.length).toBe(4);
        expect(options[0].text).toBe('First choice');
        expect(options[1].text).toBe('Second choice');
        expect(options[2].text).toBe('Third choice');
        expect(options[3].text).toBe('Fourth choice');
      });
    });

    describe('4. Watermark-safe text cleanup (cleanWatermarks)', () => {
      it('should clean targeted watermark strings while strictly preserving adjacent numeric/symbol content', () => {
        const dirty = `m = 2 kg mathongo mathongo t = 2 s`;
        const cleaned = cleanWatermarks(dirty);

        expect(cleaned).toBe('m = 2 kg t = 2 s');
        expect(cleaned).not.toBe('kg t s');
      });

      it('should preserve mathematical expressions and physics variables near watermarks', () => {
        const dirty = `At t = 2 s: vi = 5 m/s www.mathongo.com #PaperPhodnaHai`;
        const cleaned = cleanWatermarks(dirty);

        expect(cleaned).toBe('At t = 2 s: vi = 5 m/s');
      });

      it('should strip pagination watermarks like "-- 1 of 5 --"', () => {
        const dirty = `Some question text\n-- 1 of 5 --\nQuestions with Answer Keys`;
        const cleaned = cleanWatermarks(dirty);

        expect(cleaned).toBe('Some question text');
      });
      it('should preserve legitimate chapter name phrases such as "Work Power Energy" in question stems', () => {
        const text = 'Calculate the Work Power Energy dissipated when a mass m slides down an incline.';
        const cleaned = cleanWatermarks(text);
        expect(cleaned).toContain('Work Power Energy');
      });
    });

    describe('5. Sample PDF Integration Test', () => {
      it('should extract sample PDF fixture, exclude solution prose, and parse Q1/Q2 accurately', async () => {
        const samplePdfPath = path.resolve(process.cwd(), 'uploads/012b26e9-9620-4a66-bde4-95e39ac7f467.pdf');
        if (!fs.existsSync(samplePdfPath)) {
          return;
        }

        const buffer = fs.readFileSync(samplePdfPath);
        const rawText = await extractionService.extractTextFromPdf(buffer);
        const candidates = extractionService.parseCandidatesFromText(rawText);

        expect(candidates.length).toBe(6);

        // Assert no candidate contains solution text from Answers & Solutions section
        for (const candidate of candidates) {
          expect(candidate.question_text).not.toContain('Bob A swings from');
          expect(candidate.question_text).not.toContain('Velocity of A at bottom');
          expect(candidate.question_text).not.toContain('ANSWERS AND SOLUTIONS');
        }

        // Q1 assertions: real stem about 2 kg body and 4 numeric options (12, 49, 42, 24)
        const q1 = candidates[0];
        expect(q1.question_text).toContain('body of mass 2 kg is moving along');
        expect(q1.question_text).toContain('displacement as function of time');
        expect(q1.options.length).toBe(4);
        expect(q1.options.map((o) => o.text)).toEqual(['12', '49', '42', '24']);
        expect(q1.exam_name).toBe('JEE Main 2026 (21 January Shift 2)');
        expect(q1.exam_year).toBe(2026);
        expect(q1.question_type).toBe('PYQ');

        // Q2 assertions: real stem about small bob attached to rigid rod
        const q2 = candidates[1];
        expect(q2.question_text).toContain('small bob of mass is attached to a massless rigid rod');
        expect(q2.exam_name).toBe('JEE Main 2026 (23 January Shift 1)');
        expect(q2.exam_year).toBe(2026);
        expect(q2.question_type).toBe('PYQ');

        // Q4 assertions: Statement I & II with 4 statement options
        const q4 = candidates[3];
        expect(q4.question_text).toContain('Given below are two statements');
        expect(q4.options.length).toBe(4);
        expect(q4.options[0].text).toContain('Both Statement I and Statement II are false');
      });
    });

    describe('6. Honest PDF Extraction & Options (PROMPT 1)', () => {
      it('asserts extraction.service.ts contains no hardcoded question-number option arrays or academic watermark patterns', () => {
        const extractionServiceFile = fs.readFileSync(
          path.resolve(process.cwd(), 'src/modules/ingestion/extraction.service.ts'),
          'utf8'
        );
        expect(extractionServiceFile).not.toMatch(/questionNumber\s*===\s*\d+/);
        expect(DEFAULT_WATERMARK_PATTERNS.some((p) => p.toString().includes('Work Power Energy'))).toBe(false);
        expect(DEFAULT_WATERMARK_PATTERNS.some((p) => p.toString().includes('JEE Main'))).toBe(false);
      });

      it('should extract visual diagrams and options honestly without hardcoded fixture shortcuts', async () => {
        const samplePdfPath = path.resolve(process.cwd(), 'uploads/012b26e9-9620-4a66-bde4-95e39ac7f467.pdf');
        if (!fs.existsSync(samplePdfPath)) return;

        const buffer = fs.readFileSync(samplePdfPath);
        const candidates = await extractionService.extractFromPdf(buffer);

        expect(candidates.length).toBe(6);

        // Q1: Fully extracted deterministically
        const q1 = candidates[0];
        expect(q1.options.map((o) => o.text)).toEqual(['12', '49', '42', '24']);
        expect(q1.correct_answer).toBe('24');
        expect(q1.diagram_url).toBeNull();
        expect(q1.needsReview).toBe(false);

        // Q2: Visual diagram attached; layout split -> honestly flagged needsReview: true
        const q2 = candidates[1];
        expect(q2.diagram_url).toBeDefined();
        expect(q2.diagram_url).toMatch(/^data:image\/png;base64,/);
        expect(q2.needsReview).toBe(true);

        // Q3: Visual diagram attached; layout split -> honestly flagged needsReview: true
        const q3 = candidates[2];
        expect(q3.diagram_url).toBeDefined();
        expect(q3.diagram_url).toMatch(/^data:image\/png;base64,/);
        expect(q3.needsReview).toBe(true);

        // Q4: Statement options
        const q4 = candidates[3];
        expect(q4.options.length).toBe(4);
        expect(q4.options[0].text).toBe('Both Statement I and Statement II are false');
        expect(q4.correct_answer).toBe('Both Statement I and Statement II are false');
        expect(q4.diagram_url).toBeNull();
        expect(q4.needsReview).toBe(false);

        // Q5: Visual diagram attached; layout split -> honestly flagged needsReview: true
        const q5 = candidates[4];
        expect(q5.diagram_url).toBeDefined();
        expect(q5.diagram_url).toMatch(/^data:image\/png;base64,/);
        expect(q5.needsReview).toBe(true);

        // Q6: V-x graph diagram + force comparison options
        const q6 = candidates[5];
        expect(q6.diagram_url).toBeDefined();
        expect(q6.diagram_url).toMatch(/^data:image\/png;base64,/);
        expect(q6.options.length).toBeGreaterThanOrEqual(4);
        expect(q6.correct_answer).toBeTruthy();
        expect(q6.needsReview).toBe(false);
      });
    });
  });
});
