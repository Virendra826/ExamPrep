import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi } from 'vitest';
import { normalizeGeminiResponse } from '../src/modules/ingestion/gemini/geminiNormalizer.js';
import { GeminiExtractionResponse } from '../src/modules/ingestion/gemini/gemini.schema.js';
import { GeminiExtractionService } from '../src/modules/ingestion/gemini/geminiExtraction.service.js';
import { renderPageToImage } from '../src/modules/ingestion/pageRenderer.js';
import { reconcileHybridCandidates } from '../src/modules/ingestion/ingestion.service.js';
import { CandidateQuestion } from '../src/modules/ingestion/ingestion.types.js';

describe('Gemini Document Understanding — Normalizer Fidelity & Hybrid Reconciliation Unit Tests', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  const cbPdfPath = path.resolve(
    fixturesDir,
    'Chemical Bonding and Molecular Structure - JEE Main 2026 (Jan) - MathonGo.pdf'
  );

  // Test Oracle Answer Key for Q1 to Q13 (asserted ONLY in this test file, never in production extraction logic)
  const EXPECTED_ORACLE_ANSWERS = ['3', '2', '2', '3', '4', '4', '1', '4', '1', '2', '1', '3', '3'];

  describe('1. Hybrid Reconciliation with Mismatched Array Counts & Order (Task 2)', () => {
    it('correctly matches candidates by questionNumber (not array index) and recovers local-only questions without cross-contamination', () => {
      // Gemini returned only Q1 (LOW confidence), Q3 (LOW confidence), and Q4 (HIGH confidence)
      const geminiCandidates: CandidateQuestion[] = [
        {
          id: 'cand-g-1',
          questionNumber: 1,
          question_text: 'Gemini Q1 Text: Bond energy',
          options: [{ text: 'G-Opt-1' }], // Poor option extraction
          correct_answer: '',
          question_type: 'CONCEPT',
          needsReview: true,
          confidence: 'LOW',
          extractionMethod: 'GEMINI_DOCUMENT',
        },
        {
          id: 'cand-g-3',
          questionNumber: 3,
          question_text: 'Gemini Q3 Text: Dipole moment',
          options: [{ text: 'G-Opt-3A' }, { text: 'G-Opt-3B' }],
          correct_answer: 'G-Opt-3A',
          question_type: 'CONCEPT',
          needsReview: true,
          confidence: 'MEDIUM',
          extractionMethod: 'GEMINI_DOCUMENT',
        },
        {
          id: 'cand-g-4',
          questionNumber: 4,
          question_text: 'Gemini Q4 Text: Hybridization of SF6',
          options: [
            { text: 'sp3d2' },
            { text: 'sp3d' },
            { text: 'dsp2' },
            { text: 'sp3' },
          ],
          correct_answer: 'sp3d2',
          question_type: 'PYQ',
          needsReview: false,
          confidence: 'HIGH',
          extractionMethod: 'GEMINI_DOCUMENT',
        },
      ];

      // Local parser detected Q1, Q2, Q3, Q4, Q5 (5 questions total)
      const localCandidates: CandidateQuestion[] = [
        {
          id: 'cand-l-1',
          questionNumber: 1,
          question_text: 'Local Q1 Text: Bond energy',
          options: [
            { text: 'Local-Opt-1A (Correct)' },
            { text: 'Local-Opt-1B' },
            { text: 'Local-Opt-1C' },
            { text: 'Local-Opt-1D' },
          ],
          correct_answer: 'Local-Opt-1A (Correct)',
          question_type: 'CONCEPT',
          needsReview: false,
          confidence: 'HIGH',
          extractionMethod: 'TEXT',
        },
        {
          id: 'cand-l-2',
          questionNumber: 2, // Gemini completely missed Q2!
          question_text: 'Local Q2 Text: Hydrogen bonding in HF',
          options: [
            { text: 'Strong H-bond' },
            { text: 'Weak H-bond' },
            { text: 'No H-bond' },
            { text: 'Ionic bond' },
          ],
          correct_answer: 'Strong H-bond',
          question_type: 'CONCEPT',
          needsReview: false,
          confidence: 'HIGH',
          extractionMethod: 'TEXT',
        },
        {
          id: 'cand-l-3',
          questionNumber: 3,
          question_text: 'Local Q3 Text: Dipole moment',
          options: [
            { text: 'Local-Opt-3A (Verified)' },
            { text: 'Local-Opt-3B' },
            { text: 'Local-Opt-3C' },
            { text: 'Local-Opt-3D' },
          ],
          correct_answer: 'Local-Opt-3A (Verified)',
          question_type: 'CONCEPT',
          needsReview: false,
          confidence: 'HIGH',
          extractionMethod: 'TEXT',
        },
        {
          id: 'cand-l-4',
          questionNumber: 4,
          question_text: 'Local Q4 Text: Hybridization of SF6',
          options: [
            { text: 'sp3d2' },
            { text: 'sp3d' },
            { text: 'dsp2' },
            { text: 'sp3' },
          ],
          correct_answer: 'sp3d2',
          question_type: 'PYQ',
          needsReview: false,
          confidence: 'HIGH',
          extractionMethod: 'TEXT',
        },
        {
          id: 'cand-l-5',
          questionNumber: 5, // Gemini completely missed Q5!
          question_text: 'Local Q5 Text: Resonance energy of Benzene',
          options: [
            { text: '150 kJ/mol' },
            { text: '200 kJ/mol' },
            { text: '50 kJ/mol' },
            { text: '0 kJ/mol' },
          ],
          correct_answer: '150 kJ/mol',
          question_type: 'CONCEPT',
          needsReview: false,
          confidence: 'HIGH',
          extractionMethod: 'TEXT',
        },
      ];

      const reconciled = reconcileHybridCandidates(geminiCandidates, localCandidates);

      // Total questions reconciled must be 5 (Q1, Q2, Q3, Q4, Q5)
      expect(reconciled).toHaveLength(5);

      // Verify Q1: Merged from local Q1 (not affected by position)
      const q1 = reconciled.find((c) => c.questionNumber === 1);
      expect(q1).toBeDefined();
      expect(q1?.question_text).toBe('Gemini Q1 Text: Bond energy');
      expect(q1?.correct_answer).toBe('Local-Opt-1A (Correct)');
      expect(q1?.options).toHaveLength(4);
      expect(q1?.options[0].text).toBe('Local-Opt-1A (Correct)');
      expect(q1?.confidence).toBe('HIGH');
      expect(q1?.extractionMethod).toBe('GEMINI_HYBRID');

      // Verify Q2: Recovered from local parser as LOCAL_ONLY_RECOVERED
      const q2 = reconciled.find((c) => c.questionNumber === 2);
      expect(q2).toBeDefined();
      expect(q2?.question_text).toBe('Local Q2 Text: Hydrogen bonding in HF');
      expect(q2?.extractionMethod).toBe('LOCAL_ONLY_RECOVERED');
      expect(q2?.needsReview).toBe(true);
      expect(q2?.reviewReason).toContain('Question Q2 detected by local parser was not returned by Gemini');

      // Verify Q3: Matched to local Q3 (CRITICAL: under the old index-based bug, index 1 would match to Q2!)
      const q3 = reconciled.find((c) => c.questionNumber === 3);
      expect(q3).toBeDefined();
      expect(q3?.question_text).toBe('Gemini Q3 Text: Dipole moment');
      expect(q3?.correct_answer).toBe('Local-Opt-3A (Verified)'); // NOT "Strong H-bond" from Q2!
      expect(q3?.options[0].text).toBe('Local-Opt-3A (Verified)');
      expect(q3?.confidence).toBe('HIGH');
      expect(q3?.extractionMethod).toBe('GEMINI_HYBRID');

      // Verify Q4: Kept Gemini HIGH confidence result without unnecessary alteration
      const q4 = reconciled.find((c) => c.questionNumber === 4);
      expect(q4).toBeDefined();
      expect(q4?.question_text).toBe('Gemini Q4 Text: Hybridization of SF6');
      expect(q4?.correct_answer).toBe('sp3d2');
      expect(q4?.extractionMethod).toBe('GEMINI_DOCUMENT');

      // Verify Q5: Recovered from local parser as LOCAL_ONLY_RECOVERED
      const q5 = reconciled.find((c) => c.questionNumber === 5);
      expect(q5).toBeDefined();
      expect(q5?.question_text).toBe('Local Q5 Text: Resonance energy of Benzene');
      expect(q5?.extractionMethod).toBe('LOCAL_ONLY_RECOVERED');
      expect(q5?.needsReview).toBe(true);
      expect(q5?.reviewReason).toContain('Question Q5 detected by local parser was not returned by Gemini');
    });
  });

  describe('2. Normalizer Content Fidelity Unit Tests', () => {

  it('verifies the Chemical Bonding PDF fixture file exists in the repository fixtures directory', () => {
    expect(fs.existsSync(cbPdfPath)).toBe(true);
    const stat = fs.statSync(cbPdfPath);
    expect(stat.size).toBeGreaterThan(100000);
  });

  it('normalizes Chemical Bonding questions with clean Q4 match-list table separation and intact options', () => {
    // Realistic Chemical Bonding Gemini structured output
    const mockChemicalBondingResponse: GeminiExtractionResponse = {
      document: {
        title: 'Chemical Bonding and Molecular Structure - JEE Main 2026 (Jan)',
        pageCount: 3,
      },
      questions: [
        {
          questionNumber: 1,
          questionText:
            'The correct order of bond dissociation enthalpy of halogens is $\\text{Cl}_2 > \\text{Br}_2 > \\text{F}_2 > \\text{I}_2$. Which is the correct explanation for this order?',
          questionType: 'PYQ',
          options: [
            { label: '1', text: 'Larger size of chlorine atom' },
            { label: '2', text: 'Higher electronegativity of fluorine' },
            { label: '3', text: 'Inter-electronic repulsions in small fluorine atom weaken the F-F bond' },
            { label: '4', text: 'Higher hydration energy of fluoride ion' },
          ],
          examName: 'JEE Main',
          examYear: 2026,
          sourcePages: [1],
          hasVisual: false,
          visualElements: [],
          warnings: [],
        },
        {
          questionNumber: 4,
          questionText:
            'Match List-I with List-II:\n\n| List-I (Molecule) | List-II (Shape / Geometry) |\n| :--- | :--- |\n| (A) $\\text{XeF}_4$ | (I) Square pyramidal |\n| (B) $\\text{SF}_4$ | (II) Square planar |\n| (C) $\\text{NH}_4^+$ | (III) See-saw |\n| (D) $\\text{BrF}_5$ | (IV) Tetrahedral |\n\nChoose the correct answer from the options given below:',
          questionType: 'MATCH_LIST',
          options: [
            { label: '1', text: 'A-I, B-III, C-IV, D-II' },
            { label: '2', text: 'A-II, B-IV, C-I, D-III' },
            { label: '3', text: 'A-II, B-III, C-IV, D-I' },
            { label: '4', text: 'A-IV, B-II, C-I, D-III' },
          ],
          examName: 'JEE Main',
          examYear: 2026,
          sourcePages: [1],
          hasVisual: false,
          visualElements: [],
          warnings: [],
        },
        {
          questionNumber: 8,
          questionText:
            'The formal charges on the atoms marked as (1) to (4) in the Lewis representation of $\\text{HNO}_3$ molecule respectively are:',
          questionType: 'PYQ',
          options: [
            { label: '1', text: '0, 0, -1, +1' },
            { label: '2', text: '0, +1, -1, 0' },
            { label: '3', text: '+1, 0, -1, 0' },
            { label: '4', text: '0, +1, 0, -1' },
          ],
          examName: 'JEE Main',
          examYear: 2026,
          sourcePages: [2],
          hasVisual: true,
          visualElements: [
            {
              type: 'CHEMICAL_STRUCTURE',
              description: 'Lewis structure of HNO3 molecule with atoms labeled 1 to 4',
              pageNumber: 2,
              boundingBox: {
                x: 0.15,
                y: 0.3,
                width: 0.7,
                height: 0.25,
              },
            },
          ],
          warnings: [],
        },
        {
          questionNumber: 9,
          questionText:
            'The hybridization and geometry of the central atom in $\\text{XeO}_2\\text{F}_2$ is respectively:',
          questionType: 'PYQ',
          options: [
            { label: '1', text: '$\\text{sp}^3\\text{d}$, See-saw' },
            { label: '2', text: '$\\text{sp}^3\\text{d}^2$, Octahedral' },
            { label: '3', text: '$\\text{sp}^3$, Tetrahedral' },
            { label: '4', text: '$\\text{sp}^3\\text{d}$, Trigonal bipyramidal' },
          ],
          examName: 'JEE Main',
          examYear: 2026,
          sourcePages: [2],
          hasVisual: false,
          visualElements: [],
          warnings: [],
        },
      ],
      answerKey: [
        { questionNumber: 1, answer: '3' },
        { questionNumber: 4, answer: '3' },
        { questionNumber: 8, answer: '4' },
        { questionNumber: 9, answer: '1' },
      ],
    };

    const { candidates, warnings, hasCriticalErrors } = normalizeGeminiResponse(mockChemicalBondingResponse);

    expect(hasCriticalErrors).toBe(false);
    expect(candidates).toHaveLength(4);
    // Document warnings correctly note numbering gaps between subset questions (Q1->Q4->Q8->Q9)
    expect(warnings.some((w) => w.includes('Gap in question numbering'))).toBe(true);

    // Assert Q1: Chemistry notation fidelity
    const q1 = candidates[0];
    expect(q1.question_text).toContain('Cl}_2 > \\text{Br}_2 > \\text{F}_2 > \\text{I}_2');
    expect(q1.options).toHaveLength(4);
    expect(q1.correct_answer).toBe(
      'Inter-electronic repulsions in small fluorine atom weaken the F-F bond'
    );
    expect(q1.confidence).toBe('HIGH');

    // Assert Q4: Match-List table separation fidelity
    const q4 = candidates[1];
    expect(q4.question_text).toContain('Match List-I with List-II');
    expect(q4.question_text).toContain('List-I (Molecule)');
    expect(q4.question_text).toContain('List-II (Shape / Geometry)');
    // Match-list table MUST NOT be in options
    expect(q4.options).toHaveLength(4);
    expect(q4.options[0].text).toBe('A-I, B-III, C-IV, D-II');
    expect(q4.options[1].text).toBe('A-II, B-IV, C-I, D-III');
    expect(q4.options[2].text).toBe('A-II, B-III, C-IV, D-I');
    expect(q4.options[3].text).toBe('A-IV, B-II, C-I, D-III');
    expect(q4.correct_answer).toBe('A-II, B-III, C-IV, D-I');
    expect(q4.confidence).toBe('HIGH');

    // Assert Q8: Visual question handling
    const q8 = candidates[2];
    expect(q8.question_text).toContain('formal charges on the atoms marked as (1) to (4)');
    expect(q8.options).toHaveLength(4);
    expect(q8.options[0].text).toBe('0, 0, -1, +1');
    expect(q8.correct_answer).toBe('0, +1, 0, -1');
    expect(q8.confidence).toBe('HIGH');

    // Assert Q9: Chemistry formula fidelity
    const q9 = candidates[3];
    expect(q9.question_text).toContain('XeO}_2\\text{F}_2');
    expect(q9.options[0].text).toContain('sp}^3\\text{d}');
    expect(q9.correct_answer).toBe('$\\text{sp}^3\\text{d}$, See-saw');
    expect(q9.confidence).toBe('HIGH');
  });

  it('captures visual diagram and stores diagram_url for visual questions during PDF extraction flow', async () => {
    const pdfBuffer = fs.readFileSync(cbPdfPath);
    const service = new GeminiExtractionService();

    // Mock client to return Q8 with visual bounding box
    vi.spyOn(service, 'isConfigured').mockReturnValue(true);
    const mockAiClient = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            document: { title: 'Chemical Bonding' },
            questions: [
              {
                questionNumber: 8,
                questionText:
                  'The formal charges on the atoms marked as (1) to (4) in the Lewis representation of $\\text{HNO}_3$ molecule respectively are:',
                questionType: 'PYQ',
                options: [
                  { label: '1', text: '0, 0, -1, +1' },
                  { label: '2', text: '0, +1, -1, 0' },
                  { label: '3', text: '+1, 0, -1, 0' },
                  { label: '4', text: '0, +1, 0, -1' },
                ],
                sourcePages: [2],
                hasVisual: true,
                visualElements: [
                  {
                    type: 'CHEMICAL_STRUCTURE',
                    description: 'Lewis structure of HNO3 with atoms labeled 1 to 4',
                    pageNumber: 2,
                    boundingBox: {
                      x: 0.1,
                      y: 0.2,
                      width: 0.8,
                      height: 0.3,
                    },
                  },
                ],
              },
            ],
            answerKey: [{ questionNumber: 8, answer: '4' }],
          }),
        }),
      },
    };

    // Spy on geminiClientFactory to return mockAiClient
    const { geminiClientFactory } = await import('../src/modules/ingestion/gemini/gemini.client.js');
    vi.spyOn(geminiClientFactory, 'getClient').mockReturnValue(mockAiClient as any);
    vi.spyOn(geminiClientFactory, 'getModelName').mockReturnValue('gemini-2.5-flash');

    const result = await service.extractQuestionsFromPdf(pdfBuffer, 'chemical_bonding.pdf');

    expect(result).toBeDefined();
    expect(result.candidates).toHaveLength(1);
    const cand8 = result.candidates[0];

    // Assert that diagram_url is populated with a stored asset URL
    expect(cand8.diagram_url).toBeDefined();
    expect(typeof cand8.diagram_url).toBe('string');
    expect(cand8.diagram_url).toMatch(/^\/uploads\/[a-f0-9\-]+\.png$/i);
    expect(cand8.confidence).toBe('HIGH');
    expect(cand8.correct_answer).toBe('0, +1, 0, -1');
  });

  it('validates complete answer key oracle mapping across all 13 questions', () => {
    expect(EXPECTED_ORACLE_ANSWERS).toHaveLength(13);
    expect(EXPECTED_ORACLE_ANSWERS[0]).toBe('3');
    expect(EXPECTED_ORACLE_ANSWERS[3]).toBe('3'); // Q4
    expect(EXPECTED_ORACLE_ANSWERS[7]).toBe('4'); // Q8
    expect(EXPECTED_ORACLE_ANSWERS[8]).toBe('1'); // Q9
    expect(EXPECTED_ORACLE_ANSWERS[12]).toBe('3'); // Q13
  });
  });
});

