import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { scoreConfidence } from '../src/modules/ingestion/confidence.js';
import { extractionService } from '../src/modules/ingestion/extraction.service.js';

describe('Confidence Scoring (PROMPT 4)', () => {
  it('returns HIGH when all quality signals are optimal', () => {
    const confidence = scoreConfidence({
      optionCount: 4,
      hasProperOptionTexts: true,
      hasStemText: true,
      hasAnswer: true,
      hasAnswerKeyMatch: true,
      hasUnresolvedMarkersInStem: false,
    });
    expect(confidence).toBe('HIGH');
  });

  it('returns MEDIUM when answer is derived via fallback without direct answer key match', () => {
    const confidence = scoreConfidence({
      optionCount: 4,
      hasProperOptionTexts: true,
      hasStemText: true,
      hasAnswer: true,
      hasAnswerKeyMatch: false,
      hasUnresolvedMarkersInStem: false,
    });
    expect(confidence).toBe('MEDIUM');
  });

  it('returns LOW when options are missing or less than 2', () => {
    const confidence = scoreConfidence({
      optionCount: 0,
      hasProperOptionTexts: false,
      hasStemText: true,
      hasAnswer: false,
      hasAnswerKeyMatch: false,
    });
    expect(confidence).toBe('LOW');
  });

  it('returns LOW when stem text is too short or missing', () => {
    const confidence = scoreConfidence({
      optionCount: 4,
      hasProperOptionTexts: true,
      hasStemText: false,
      hasAnswer: true,
      hasAnswerKeyMatch: true,
    });
    expect(confidence).toBe('LOW');
  });

  it('attaches valid confidence values to each candidate from sample PDF', async () => {
    const samplePdfPath = path.resolve(process.cwd(), 'uploads/012b26e9-9620-4a66-bde4-95e39ac7f467.pdf');
    if (!fs.existsSync(samplePdfPath)) return;

    const buffer = fs.readFileSync(samplePdfPath);
    const candidates = await extractionService.extractFromPdf(buffer);

    expect(candidates.length).toBe(6);
    for (const c of candidates) {
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(c.confidence);
      // needsReview is backward compatible with confidence
      expect(c.needsReview).toBe(c.confidence !== 'HIGH');
    }

    // Deterministic full questions should be HIGH
    expect(candidates[0].confidence).toBe('HIGH');
    expect(candidates[3].confidence).toBe('HIGH');
    expect(candidates[5].confidence).toBe('HIGH');
    // Questions requiring review (diagram/image options like Q2, Q3, Q5) should be LOW
    expect(candidates[1].confidence).toBe('LOW');
    expect(candidates[2].confidence).toBe('LOW');
    expect(candidates[4].confidence).toBe('LOW');
  });
});
