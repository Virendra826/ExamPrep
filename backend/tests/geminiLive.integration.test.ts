import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { geminiExtractionService } from '../src/modules/ingestion/gemini/index.js';
import { env } from '../src/config/env.js';

const isLiveTestEnabled =
  process.env.RUN_LIVE_GEMINI_TESTS === 'true' &&
  Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);

describe.skipIf(!isLiveTestEnabled)(
  'Live Gemini Extraction Pipeline Integration Test (Opt-in via RUN_LIVE_GEMINI_TESTS=true)',
  () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const cbPdfPath = path.resolve(
      fixturesDir,
      'Chemical Bonding and Molecular Structure - JEE Main 2026 (Jan) - MathonGo.pdf'
    );
    const wpePdfPath = path.resolve(
      fixturesDir,
      'Work Power Energy - JEE Main 2026 (Jan) - MathonGo.pdf'
    );

    it('extracts real Chemical Bonding PDF through live Gemini API with structural fidelity', async () => {
      expect(fs.existsSync(cbPdfPath)).toBe(true);
      const buffer = fs.readFileSync(cbPdfPath);

      console.info('\n[Live Gemini Test] Starting live extraction on Chemical Bonding PDF...');
      const result = await geminiExtractionService.extractQuestionsFromPdf(
        buffer,
        'chemical_bonding_live.pdf',
        120000 // 2 minutes timeout for live multimodal document understanding
      );

      console.info(
        `[Live Gemini Test] Chemical Bonding Extraction completed in ${result.processingDurationMs}ms. Extracted ${result.candidates.length} candidates.`
      );

      // Print raw candidates summary for human review
      console.log(
        '\n========== CHEMICAL BONDING LIVE EXTRACTED CANDIDATES ==========\n' +
          JSON.stringify(
            result.candidates.map((c) => ({
              qNum: c.questionNumber,
              text: c.question_text.slice(0, 80) + '...',
              optionCount: c.options.length,
              options: c.options.map((o) => o.text.slice(0, 40)),
              answer: c.correct_answer,
              confidence: c.confidence,
              diagram: c.diagram_url ? 'PRESENT' : 'NONE',
            })),
            null,
            2
          ) +
          '\n=================================================================\n'
      );

      // Assert structural validity without hardcoding document-specific content
      expect(result.candidates.length).toBeGreaterThanOrEqual(10);
      expect(result.candidates.length).toBeLessThanOrEqual(16);

      for (const cand of result.candidates) {
        expect(cand.question_text.trim().length).toBeGreaterThan(10);
        // Must have at least 2 non-empty options
        expect(cand.options.length).toBeGreaterThanOrEqual(2);
        for (const opt of cand.options) {
          expect(opt.text.trim().length).toBeGreaterThan(0);
        }
        // Must not contain unparsed tab characters or raw boilerplate
        expect(cand.question_text).not.toContain('\t');
        expect(cand.question_text).not.toMatch(/Choose the correct answer from the options/i);
      }
    }, 150000);

    it('extracts real Work Power Energy PDF through live Gemini API with structural fidelity', async () => {
      expect(fs.existsSync(wpePdfPath)).toBe(true);
      const buffer = fs.readFileSync(wpePdfPath);

      console.info('\n[Live Gemini Test] Starting live extraction on Work Power Energy PDF...');
      const result = await geminiExtractionService.extractQuestionsFromPdf(
        buffer,
        'work_power_energy_live.pdf',
        120000
      );

      console.info(
        `[Live Gemini Test] Work Power Energy Extraction completed in ${result.processingDurationMs}ms. Extracted ${result.candidates.length} candidates.`
      );

      // Print raw candidates summary for human review
      console.log(
        '\n========== WORK POWER ENERGY LIVE EXTRACTED CANDIDATES ==========\n' +
          JSON.stringify(
            result.candidates.map((c) => ({
              qNum: c.questionNumber,
              text: c.question_text.slice(0, 80) + '...',
              optionCount: c.options.length,
              options: c.options.map((o) => o.text.slice(0, 40)),
              answer: c.correct_answer,
              confidence: c.confidence,
              diagram: c.diagram_url ? 'PRESENT' : 'NONE',
            })),
            null,
            2
          ) +
          '\n=================================================================\n'
      );

      // Assert structural validity for WPE (approx 6 questions)
      expect(result.candidates.length).toBeGreaterThanOrEqual(4);
      expect(result.candidates.length).toBeLessThanOrEqual(8);

      for (const cand of result.candidates) {
        expect(cand.question_text.trim().length).toBeGreaterThan(10);
        expect(cand.options.length).toBeGreaterThanOrEqual(2);
        for (const opt of cand.options) {
          expect(opt.text.trim().length).toBeGreaterThan(0);
        }
        expect(cand.question_text).not.toContain('\t');
      }
    }, 150000);
  }
);
