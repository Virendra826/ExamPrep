import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { ingestionService } from '../src/modules/ingestion/ingestion.service.js';
import { geminiExtractionService } from '../src/modules/ingestion/gemini/index.js';
import { extractionService } from '../src/modules/ingestion/extraction.service.js';

describe('Gemini Primary with Local Fallback Integration', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const resolveFixture = (...names: string[]) => {
    for (const name of names) {
      const p = path.resolve(fixturesDir, name);
      if (fs.existsSync(p)) return p;
    }
    return path.resolve(fixturesDir, names[0]);
  };
  const cbPdfPath = resolveFixture(
    'Chemical Bonding and Molecular Structure - JEE Main 2026 (Jan) - MathonGo.pdf',
    'chemical_bonding.pdf'
  );
  const wpePdfPath = resolveFixture(
    'Work Power Energy - JEE Main 2026 (Jan) - MathonGo.pdf',
    'work_power_energy.pdf'
  );
  let adminUserId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    if (!admin) {
      throw new Error('Admin user not found in database for testing');
    }
    adminUserId = admin.id;
  });

  it('gracefully falls back to local parser when Gemini throws an error or is unconfigured', async () => {
    // Mock geminiExtractionService to be configured but throw a rate limit error
    vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);
    vi.spyOn(geminiExtractionService, 'extractQuestionsFromPdf').mockRejectedValue(
      new Error('Gemini API quota / rate limit exceeded (HTTP 429)')
    );

    const pdfBuffer = fs.readFileSync(cbPdfPath);
    const mockFile: Express.Multer.File = {
      buffer: pdfBuffer,
      originalname: 'chemical_bonding.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    // The uploadAndExtract method should succeed using fallback to local parser
    const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);

    expect(result).toBeDefined();
    expect(result.batch).toBeDefined();
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].question_text).toBeDefined();
    expect(result.candidates[0].options.length).toBeGreaterThanOrEqual(2);
  });

  it('uses Gemini result directly when Gemini extraction succeeds', async () => {
    // Mock Gemini extraction to return high-fidelity candidate questions
    vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);
    vi.spyOn(geminiExtractionService, 'extractQuestionsFromPdf').mockResolvedValue({
      candidates: [
        {
          id: 'cand-gemini-test-1',
          question_text: 'Which of the following contains both covalent and coordinate bonds?',
          options: [
            { text: '$\\text{NH}_4\\text{Cl}$' },
            { text: '$\\text{NaCl}$' },
            { text: '$\\text{CH}_4$' },
            { text: '$\\text{H}_2\\text{O}$' },
          ],
          correct_answer: '$\\text{NH}_4\\text{Cl}$',
          question_type: 'CONCEPT',
          needsReview: false,
          confidence: 'HIGH',
          extractionMethod: 'GEMINI_DOCUMENT',
          sourcePages: [1],
        },
      ],
      warnings: [],
      processingDurationMs: 1200,
    });

    const pdfBuffer = fs.readFileSync(cbPdfPath);
    const mockFile: Express.Multer.File = {
      buffer: pdfBuffer,
      originalname: 'chemical_bonding.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);

    expect(result).toBeDefined();
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe('cand-gemini-test-1');
    expect(result.candidates[0].extractionMethod).toBe('GEMINI_DOCUMENT');
    expect(result.candidates[0].correct_answer).toBe('$\\text{NH}_4\\text{Cl}$');
  });

  it('triggers hybrid reconciliation when Gemini produces low/medium confidence candidates, merging local high-confidence options', async () => {
    // Mock Gemini extraction to return a LOW-confidence candidate with missing options
    vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);
    vi.spyOn(geminiExtractionService, 'extractQuestionsFromPdf').mockResolvedValue({
      candidates: [
        {
          id: 'cand-gemini-low-1',
          question_text: 'What is the critical section problem in operating systems?',
          options: [],
          correct_answer: '',
          question_type: 'CONCEPT',
          needsReview: true,
          confidence: 'LOW',
          extractionMethod: 'GEMINI_DOCUMENT',
          reviewReason: 'Missing options in structured field',
        },
      ],
      warnings: ['Missing options for Q1'],
      hasCriticalErrors: true,
      confidenceCounts: { high: 0, medium: 0, low: 1 },
      processingDurationMs: 800,
    });

    // Mock local extractionService to return HIGH-confidence candidate
    vi.spyOn(extractionService, 'extractFromPdf').mockResolvedValue([
      {
        id: 'cand-local-high-1',
        question_text: 'What is the critical section problem in operating systems?',
        options: [
          { text: 'A section where shared resources are accessed' },
          { text: 'A hardware fault zone' },
          { text: 'A memory leak area' },
          { text: 'A deadlock state' },
        ],
        correct_answer: 'A section where shared resources are accessed',
        question_type: 'CONCEPT',
        needsReview: false,
        confidence: 'HIGH',
        extractionMethod: 'DETERMINISTIC_PDF',
      },
    ]);

    const pdfBuffer = fs.readFileSync(cbPdfPath);
    const mockFile: Express.Multer.File = {
      buffer: pdfBuffer,
      originalname: 'test_doc.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);

    expect(result).toBeDefined();
    expect(result.candidates).toHaveLength(1);
    const reconciled = result.candidates[0];

    // Assert that local high-confidence options and answer were merged into the candidate
    expect(reconciled.extractionMethod).toBe('GEMINI_HYBRID');
    expect(reconciled.confidence).toBe('HIGH');
    expect(reconciled.options).toHaveLength(4);
    expect(reconciled.options[0].text).toBe('A section where shared resources are accessed');
    expect(reconciled.correct_answer).toBe('A section where shared resources are accessed');
    expect(reconciled.reviewReason).toContain('Reconciled: Local deterministic parser provided higher confidence');
  });

  it('marks candidate for review with audit reason when Gemini and local parser disagree', async () => {
    // Mock Gemini extraction returning HIGH confidence with answer X
    vi.spyOn(geminiExtractionService, 'isConfigured').mockReturnValue(true);
    vi.spyOn(geminiExtractionService, 'extractQuestionsFromPdf').mockResolvedValue({
      candidates: [
        {
          id: 'cand-gemini-disagree-1',
          question_text: 'Which molecule is polar?',
          options: [{ text: 'CO2' }, { text: 'H2O' }, { text: 'BF3' }, { text: 'CH4' }],
          correct_answer: 'H2O',
          question_type: 'CONCEPT',
          needsReview: false,
          confidence: 'MEDIUM',
          extractionMethod: 'GEMINI_DOCUMENT',
        },
      ],
      warnings: [],
      hasCriticalErrors: true,
      confidenceCounts: { high: 0, medium: 1, low: 0 },
      processingDurationMs: 600,
    });

    // Mock local extractionService returning different answer Y
    vi.spyOn(extractionService, 'extractFromPdf').mockResolvedValue([
      {
        id: 'cand-local-disagree-1',
        question_text: 'Which molecule is polar?',
        options: [{ text: 'CO2' }, { text: 'H2O' }, { text: 'BF3' }, { text: 'CH4' }],
        correct_answer: 'CO2', // Disagrees with Gemini
        question_type: 'CONCEPT',
        needsReview: false,
        confidence: 'MEDIUM',
        extractionMethod: 'DETERMINISTIC_PDF',
      },
    ]);

    const pdfBuffer = fs.readFileSync(cbPdfPath);
    const mockFile: Express.Multer.File = {
      buffer: pdfBuffer,
      originalname: 'test_doc.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    const result = await ingestionService.uploadAndExtract(mockFile, adminUserId);

    expect(result).toBeDefined();
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];

    expect(candidate.extractionMethod).toBe('GEMINI_HYBRID');
    expect(candidate.needsReview).toBe(true);
    expect(candidate.reviewReason).toContain('Gemini and local parser disagree on option set/answer');
  });
});
