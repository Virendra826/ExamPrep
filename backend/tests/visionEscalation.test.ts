import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import * as visionModule from '../src/modules/ingestion/vision/index.js';
import { extractionService } from '../src/modules/ingestion/extraction.service.js';
import { QuestionExtractionProvider, VisionQuestionResult } from '../src/modules/ingestion/vision/index.js';

describe('Vision Escalation for Low-Confidence Questions (PROMPT 5)', () => {
  const samplePdfPath = path.resolve(process.cwd(), 'uploads/012b26e9-9620-4a66-bde4-95e39ac7f467.pdf');

  it('triggers vision escalation for low-confidence candidates when vision provider is configured', async () => {
    if (!fs.existsSync(samplePdfPath)) return;
    const buffer = fs.readFileSync(samplePdfPath);

    const mockReconstruct = vi.fn().mockResolvedValue({
      questionText: 'Reconstructed Question Stem with diagram',
      options: [
        { label: '1', text: '1/5' },
        { label: '2', text: '(2-√3)/5' },
        { label: '3', text: '3/5' },
        { label: '4', text: '(2+√3)/5' },
      ],
      detectedAnswerLetter: 'A',
      hasVisual: true,
      confidence: 'HIGH',
    } satisfies VisionQuestionResult);

    const mockProvider: QuestionExtractionProvider = {
      isConfigured: () => true,
      reconstructQuestion: mockReconstruct,
    };

    vi.spyOn(visionModule, 'getVisionProvider').mockReturnValue(mockProvider);

    const candidates = await extractionService.extractFromPdf(buffer);

    expect(mockReconstruct).toHaveBeenCalled();
    // Q2 is LOW confidence, should now be upgraded via vision
    const q2 = candidates[1];
    expect(q2.extractionMethod).toBe('TEXT_PLUS_VISION');
    expect(q2.question_text).toBe('Reconstructed Question Stem with diagram');
    expect(q2.options.length).toBe(4);
    expect(q2.options[0].text).toBe('1/5');
    expect(q2.correct_answer).toBe('1/5');
    expect(q2.confidence).toBe('HIGH');
    expect(q2.needsReview).toBe(false);

    vi.restoreAllMocks();
  }, 15000);

  it('gracefully degrades and preserves deterministic result if vision provider fails/throws', async () => {
    if (!fs.existsSync(samplePdfPath)) return;
    const buffer = fs.readFileSync(samplePdfPath);

    const mockReconstruct = vi.fn().mockRejectedValue(new Error('Vision API rate limit exceeded'));

    const mockProvider: QuestionExtractionProvider = {
      isConfigured: () => true,
      reconstructQuestion: mockReconstruct,
    };

    vi.spyOn(visionModule, 'getVisionProvider').mockReturnValue(mockProvider);

    const candidates = await extractionService.extractFromPdf(buffer);

    expect(mockReconstruct).toHaveBeenCalled();
    // Ingestion succeeds without throwing; Q2 retains original deterministic values
    const q2 = candidates[1];
    expect(q2.extractionMethod).toBe('TEXT');
    expect(q2.confidence).toBe('LOW');
    expect(q2.needsReview).toBe(true);

    vi.restoreAllMocks();
  }, 15000);

  it('does not trigger vision escalation when provider is disabled/unconfigured', async () => {
    if (!fs.existsSync(samplePdfPath)) return;
    const buffer = fs.readFileSync(samplePdfPath);

    const mockReconstruct = vi.fn();
    const mockProvider: QuestionExtractionProvider = {
      isConfigured: () => false,
      reconstructQuestion: mockReconstruct,
    };

    vi.spyOn(visionModule, 'getVisionProvider').mockReturnValue(mockProvider);

    const candidates = await extractionService.extractFromPdf(buffer);

    expect(mockReconstruct).not.toHaveBeenCalled();
    expect(candidates.length).toBe(6);

    vi.restoreAllMocks();
  });
});
