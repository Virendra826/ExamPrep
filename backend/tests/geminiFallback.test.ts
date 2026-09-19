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
});
