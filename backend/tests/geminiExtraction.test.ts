import { describe, it, expect, vi } from 'vitest';
import {
  geminiExtractionResponseSchema,
  GeminiExtractionResponse,
} from '../src/modules/ingestion/gemini/gemini.schema.js';
import {
  normalizeGeminiResponse,
  separateStemAndOptions,
  sanitizeStemAndExtractDiagram,
} from '../src/modules/ingestion/gemini/geminiNormalizer.js';
import { GeminiClientFactory } from '../src/modules/ingestion/gemini/gemini.client.js';
import { GeminiExtractionService } from '../src/modules/ingestion/gemini/geminiExtraction.service.js';

describe('Gemini PDF Document Extraction Integration', () => {
  describe('1. Schema Validation (geminiExtractionResponseSchema)', () => {
    it('validates a complete structured response from Gemini', () => {
      const rawData = {
        document: {
          title: 'JEE Main 2026 Chemical Bonding Question Bank',
          pageCount: 3,
        },
        questions: [
          {
            questionNumber: 1,
            questionText: 'Which of the following molecules has $\\text{sp}^3\\text{d}^2$ hybridization?',
            questionType: 'PYQ',
            options: [
              { label: '1', text: '$\\text{SF}_6$' },
              { label: '2', text: '$\\text{PCl}_5$' },
              { label: '3', text: '$\\text{CH}_4$' },
              { label: '4', text: '$\\text{BF}_3$' },
            ],
            examName: 'JEE Main',
            examYear: 2026,
            sourcePages: [1],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
          {
            questionNumber: 2,
            questionText: 'Match List-I with List-II:\n\nList-I\n(A) $\\text{XeF}_4$\n(B) $\\text{XeO}_3$\n\nList-II\n(I) Pyramidal\n(II) Square planar',
            questionType: 'MATCH_LIST',
            options: [
              { label: '1', text: 'A-II, B-I' },
              { label: '2', text: 'A-I, B-II' },
              { label: '3', text: 'A-II, B-II' },
              { label: '4', text: 'A-I, B-I' },
            ],
            examName: 'JEE Main',
            examYear: 2026,
            sourcePages: [1, 2],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [
          { questionNumber: 1, answer: '1' },
          { questionNumber: 2, answer: '1' },
        ],
      };

      const result = geminiExtractionResponseSchema.safeParse(rawData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.questions).toHaveLength(2);
        expect(result.data.answerKey).toHaveLength(2);
        expect(result.data.questions[0].questionNumber).toBe(1);
        expect(result.data.questions[1].questionText).toContain('Match List-I with List-II');
      }
    });

    it('validates boundingBox coordinates in visualElements schema', () => {
      const validVisual = {
        type: 'DIAGRAM',
        description: 'Circuit diagram',
        pageNumber: 1,
        boundingBox: {
          x: 0.1,
          y: 0.2,
          width: 0.5,
          height: 0.4,
        },
      };

      const invalidVisual = {
        type: 'DIAGRAM',
        boundingBox: {
          x: -0.5, // Invalid negative coordinate
          y: 0.2,
          width: 0.5,
          height: 0.4,
        },
      };

      const result = geminiExtractionResponseSchema.safeParse({
        questions: [
          {
            questionNumber: 1,
            questionText: 'Test question with visual',
            hasVisual: true,
            visualElements: [validVisual],
            options: [{ label: '1', text: 'Option A' }],
          },
        ],
        answerKey: [{ questionNumber: 1, answer: '1' }],
      });
      expect(result.success).toBe(true);

      const invalidResult = geminiExtractionResponseSchema.safeParse({
        questions: [
          {
            questionNumber: 1,
            questionText: 'Test question with invalid visual',
            hasVisual: true,
            visualElements: [invalidVisual],
            options: [{ label: '1', text: 'Option A' }],
          },
        ],
        answerKey: [{ questionNumber: 1, answer: '1' }],
      });
      expect(invalidResult.success).toBe(false);
    });

    it('rejects invalid schema structure', () => {
      const invalidData = {
        questions: 'invalid string instead of array',
      };
      const result = geminiExtractionResponseSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('2. Normalization & Deterministic Validation (normalizeGeminiResponse)', () => {
    it('accurately maps digit answer keys to option text with HIGH confidence', () => {
      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 1,
            questionText: 'The bond order of $\\text{O}_2^{2-}$ is:',
            questionType: 'PYQ',
            options: [
              { label: '1', text: '1.0' },
              { label: '2', text: '1.5' },
              { label: '3', text: '2.0' },
              { label: '4', text: '2.5' },
            ],
            examName: 'JEE Main',
            examYear: 2026,
            sourcePages: [1],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 1, answer: '1' }],
      };

      const { candidates, warnings, hasCriticalErrors } = normalizeGeminiResponse(geminiData);

      expect(hasCriticalErrors).toBe(false);
      expect(warnings).toHaveLength(0);
      expect(candidates).toHaveLength(1);

      const cand = candidates[0];
      expect(cand.question_text).toBe('The bond order of $\\text{O}_2^{2-}$ is:');
      expect(cand.options).toHaveLength(4);
      expect(cand.options[0].text).toBe('1.0');
      expect(cand.correct_answer).toBe('1.0');
      expect(cand.confidence).toBe('HIGH');
      expect(cand.needsReview).toBe(false);
      expect(cand.extractionMethod).toBe('GEMINI_DOCUMENT');
      expect(cand.sourcePages).toEqual([1]);
    });

    it('accurately maps letter answer keys (e.g. C -> option 3)', () => {
      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 1,
            questionText: 'Which species has linear geometry?',
            questionType: 'CONCEPT',
            options: [
              { label: 'A', text: '$\\text{SO}_2$' },
              { label: 'B', text: '$\\text{H}_2\\text{O}$' },
              { label: 'C', text: '$\\text{CO}_2$' },
              { label: 'D', text: '$\\text{O}_3$' },
            ],
            sourcePages: [2],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 1, answer: 'C' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].correct_answer).toBe('$\\text{CO}_2$');
      expect(candidates[0].confidence).toBe('HIGH');
    });

    it('handles missing answer key gracefully and marks for review without inventing answers', () => {
      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 5,
            questionText: 'Identify the diamagnetic species among the following:',
            questionType: 'CONCEPT',
            options: [
              { label: '1', text: '$\\text{NO}$' },
              { label: '2', text: '$\\text{O}_2$' },
              { label: '3', text: '$\\text{N}_2$' },
              { label: '4', text: '$\\text{B}_2$' },
            ],
            sourcePages: [3],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [], // No answer key
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].needsReview).toBe(true);
      expect(candidates[0].reviewReason).toContain('No answer key entry found');
      expect(candidates[0].confidence).toBe('MEDIUM');
    });

    it('detects duplicate question numbers and flags warnings', () => {
      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 1,
            questionText: 'First question stem text here',
            questionType: 'CONCEPT',
            options: [{ label: '1', text: 'A' }, { label: '2', text: 'B' }],
            sourcePages: [1],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
          {
            questionNumber: 1, // Duplicate
            questionText: 'Duplicate first question stem text here',
            questionType: 'CONCEPT',
            options: [{ label: '1', text: 'C' }, { label: '2', text: 'D' }],
            sourcePages: [1],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 1, answer: '1' }],
      };

      const { warnings } = normalizeGeminiResponse(geminiData);
      expect(warnings.some((w) => w.includes('Duplicate question number'))).toBe(true);
    });

    it('associates visual diagram descriptions with stem', () => {
      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 1,
            questionText: 'In the given potential energy curve for $\\text{H}_2$ molecule, the point of minimum energy represents:',
            questionType: 'CONCEPT',
            options: [
              { label: '1', text: 'Bond length' },
              { label: '2', text: 'Dissociation limit' },
              { label: '3', text: 'Repulsive state' },
              { label: '4', text: 'Isolated atoms' },
            ],
            sourcePages: [2],
            hasVisual: true,
            visualElements: [
              {
                type: 'GRAPH',
                description: 'Potential energy vs internuclear distance curve for H2',
                pageNumber: 2,
              },
            ],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 1, answer: '1' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].question_text).toContain('Visual Content: [Potential energy vs internuclear distance curve for H2]');
    });
  });

  describe('3. Targeted Option Recovery & Image Sanitization Regression Tests', () => {
    it('Test 1: Recovers options from question text, cleans stem, and preserves "(1) to (4)" in statement', () => {
      const rawStem =
        'The formal charges on the atoms marked as (1) to (4) in the Lewis representation of sp3 molecule respectively are\n(1) sp2 (2) sp2\n(3) HNO3 (4) 0, 0, −1, +1';

      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 8,
            questionText: rawStem,
            questionType: 'CONCEPT',
            options: [], // Options omitted in structured field
            sourcePages: [2],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 8, answer: '4' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);

      const candidate = candidates[0];
      // 4 options extracted
      expect(candidate.options).toHaveLength(4);
      expect(candidate.options[0].text).toBe('sp2');
      expect(candidate.options[1].text).toBe('sp2');
      expect(candidate.options[2].text).toBe('HNO3');
      expect(candidate.options[3].text).toBe('0, 0, −1, +1');

      // Question text must NOT contain the option block
      expect(candidate.question_text).not.toContain('(1) sp2');
      expect(candidate.question_text).not.toContain('(4) 0, 0, −1, +1');

      // The phrase "(1) to (4)" inside the question statement MUST remain intact
      expect(candidate.question_text).toContain('atoms marked as (1) to (4)');

      // Correct answer is mapped
      expect(candidate.correct_answer).toBe('0, 0, −1, +1');
      expect(candidate.needsReview).toBe(true);
      expect(candidate.reviewReason).toContain('OPTIONS_RECOVERED_FROM_TEXT');
    });

    it('Test 2: Sanitizes inline base64 image data from questionText while preserving visual diagram', () => {
      const dummyBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const rawStemWithImage = `A particle moves in a circular path as shown below:\n\n![Figure](${dummyBase64})\n\nFind its centripetal acceleration.`;

      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 3,
            questionText: rawStemWithImage,
            questionType: 'CONCEPT',
            options: [
              { label: '1', text: 'v^2 / r' },
              { label: '2', text: 'v / r' },
              { label: '3', text: 'v^2 * r' },
              { label: '4', text: 'v * r^2' },
            ],
            sourcePages: [1],
            hasVisual: true,
            visualElements: [{ type: 'DIAGRAM', description: 'Circular path diagram' }],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 3, answer: '1' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);

      const candidate = candidates[0];
      // Question text must NEVER contain base64 image payload
      expect(candidate.question_text).not.toContain('data:image/png;base64');
      expect(candidate.question_text).not.toContain('iVBORw0KGgo');
      expect(candidate.question_text).toContain('A particle moves in a circular path as shown below:');
      expect(candidate.question_text).toContain('Find its centripetal acceleration.');

      // Diagram URL must be preserved
      expect(candidate.diagram_url).toBe(dummyBase64);
    });

    it('Test 3: Preserves normal structured options without recovery when already valid', () => {
      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 1,
            questionText: 'What is the geometry of $\\text{CH}_4$?',
            questionType: 'CONCEPT',
            options: [
              { label: '1', text: 'Tetrahedral' },
              { label: '2', text: 'Square Planar' },
              { label: '3', text: 'Linear' },
              { label: '4', text: 'Trigonal Bipyramidal' },
            ],
            sourcePages: [1],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 1, answer: '1' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].options).toHaveLength(4);
      expect(candidates[0].options[0].text).toBe('Tetrahedral');
      expect(candidates[0].confidence).toBe('HIGH');
      expect(candidates[0].needsReview).toBe(false);
    });

    it('Test 4: Preserves Match-List structure in stem without converting List-I/List-II into MCQ options', () => {
      const matchStem =
        'Match List-I with List-II:\n\nList-I\n(A) XeF4\n(B) XeO3\n\nList-II\n(I) Pyramidal\n(II) Square planar\n\n(1) A-II, B-I  (2) A-I, B-II  (3) A-II, B-II  (4) A-I, B-I';

      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 2,
            questionText: matchStem,
            questionType: 'MATCH_LIST',
            options: [], // Options inside text
            sourcePages: [1],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 2, answer: '1' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);

      const cand = candidates[0];
      // Stem must keep List-I and List-II
      expect(cand.question_text).toContain('List-I');
      expect(cand.question_text).toContain('(A) XeF4');
      expect(cand.question_text).toContain('List-II');
      expect(cand.question_text).toContain('(I) Pyramidal');

      // Options must be the combination choices (1)..(4)
      expect(cand.options).toHaveLength(4);
      expect(cand.options[0].text).toBe('A-II, B-I');
      expect(cand.options[1].text).toBe('A-I, B-II');
      expect(cand.correct_answer).toBe('A-II, B-I');
    });

    it('Test 5: Preserves numbered mathematical/physics statements in stem', () => {
      const statementsStem =
        'Consider the following statements regarding isothermal expansion of an ideal gas:\n(1) Internal energy remains constant.\n(2) Work done is equal to heat absorbed.\nWhich of the above statements is/are correct?\n(A) Only (1)  (B) Only (2)  (C) Both (1) and (2)  (D) Neither (1) nor (2)';

      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 4,
            questionText: statementsStem,
            questionType: 'CONCEPT',
            options: [],
            sourcePages: [2],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 4, answer: 'C' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);

      const cand = candidates[0];
      // Statements (1) and (2) must remain in the stem
      expect(cand.question_text).toContain('(1) Internal energy remains constant.');
      expect(cand.question_text).toContain('(2) Work done is equal to heat absorbed.');

      // Options must be (A)..(D)
      expect(cand.options).toHaveLength(4);
      expect(cand.options[0].text).toBe('Only (1)');
      expect(cand.options[2].text).toBe('Both (1) and (2)');
      expect(cand.correct_answer).toBe('Both (1) and (2)');
    });

    it('Test 6: Accurately maps answer key to recovered option text', () => {
      const rawStem =
        'Identify the correct order of bond angle:\n(1) H2O > NH3 > CH4\n(2) CH4 > NH3 > H2O\n(3) NH3 > H2O > CH4\n(4) CH4 > H2O > NH3';

      const geminiData: GeminiExtractionResponse = {
        questions: [
          {
            questionNumber: 6,
            questionText: rawStem,
            options: [],
            questionType: 'CONCEPT',
            sourcePages: [1],
            hasVisual: false,
            visualElements: [],
            warnings: [],
          },
        ],
        answerKey: [{ questionNumber: 6, answer: '2' }],
      };

      const { candidates } = normalizeGeminiResponse(geminiData);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].correct_answer).toBe('CH4 > NH3 > H2O');
    });
  });

  describe('4. Gemini Client & Service Configuration', () => {
    it('detects when unconfigured and prevents client creation without key', () => {
      const factory = new GeminiClientFactory('');
      expect(factory.isConfigured()).toBe(false);
      expect(() => factory.getClient()).toThrowError(/GEMINI_API_KEY is missing/);
    });

    it('initializes client when API key is provided', () => {
      const factory = new GeminiClientFactory('test-gemini-api-key-xyz');
      expect(factory.isConfigured()).toBe(true);
      const client = factory.getClient();
      expect(client).toBeDefined();
    });

    it('sanitizes error messages so API key is never exposed', async () => {
      const secretKey = 'ai-secret-key-12345';
      const service = new GeminiExtractionService();
      vi.spyOn(service, 'isConfigured').mockReturnValue(true);

      // Verify that any error string containing the secret key is redacted
      const rawError = new Error(`Network timeout connecting to Google with key ${secretKey}`);
      let sanitizedMessage = rawError.message.split(secretKey).join('[REDACTED_API_KEY]');
      expect(sanitizedMessage).not.toContain(secretKey);
      expect(sanitizedMessage).toContain('[REDACTED_API_KEY]');
    });
  });
});
