import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  extractionService,
  FOOTER_WATERMARK_PATTERN,
  reattachDisplacedFragments,
  extractFloatingFragments,
} from "../src/modules/ingestion/extraction.service.js";

describe("Extraction Subsystem Regression Test Matrix (PROMPT 9)", () => {
  const fixturesDir = path.resolve(__dirname, "fixtures");
  const wpePdfPath = path.resolve(fixturesDir, "work_power_energy.pdf");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Matrix 1: Real PDF Ingestion — Work Power Energy Sample", () => {
    it("extracts questions, separates answer key, populates provenance, and scores confidence", async () => {
      if (!fs.existsSync(wpePdfPath)) {
        // Fallback to uploads path if not in fixtures
        const fallbackPath = path.resolve(
          __dirname,
          "../uploads/012b26e9-9620-4a66-bde4-95e39ac7f467.pdf"
        );
        if (!fs.existsSync(fallbackPath)) {
          return; // Skip if file not found in test environment
        }
      }

      const activePdfPath = fs.existsSync(wpePdfPath)
        ? wpePdfPath
        : path.resolve(__dirname, "../uploads/012b26e9-9620-4a66-bde4-95e39ac7f467.pdf");

      const pdfBuffer = fs.readFileSync(activePdfPath);
      const candidates = await extractionService.extractFromPdf(
        pdfBuffer,
        "Work_Power_Energy_-_JEE_Main_2026__Jan__-_MathonGo.pdf"
      );

      // Verify question count & segmentation
      expect(candidates.length).toBeGreaterThanOrEqual(6);

      // Verify every candidate has required structural properties
      for (const cand of candidates) {
        expect(cand.id).toBeDefined();
        expect(cand.question_text.length).toBeGreaterThan(0);
        expect(["CONCEPT", "PYQ"]).toContain(cand.question_type);
        expect(["HIGH", "MEDIUM", "LOW"]).toContain(cand.confidence);
        expect(["TEXT", "TEXT_PLUS_VISION"]).toContain(cand.extractionMethod);
        expect(Array.isArray(cand.sourcePages)).toBe(true);
        expect(cand.sourcePages?.length).toBeGreaterThan(0);
      }

      // Verify clean candidates have valid options
      const cleanCandidates = candidates.filter((c) => c.options.length >= 2);
      expect(cleanCandidates.length).toBeGreaterThanOrEqual(3);

      // Spot check Q1: should have 4 options and valid correct_answer
      const q1 = candidates[0];
      expect(q1.options.length).toBe(4);
      expect(q1.correct_answer.length).toBeGreaterThan(0);

      // Spot check PYQ metadata extraction
      const pyqCandidates = candidates.filter((c) => c.question_type === "PYQ");
      expect(pyqCandidates.length).toBeGreaterThan(0);
      for (const pyq of pyqCandidates) {
        expect(pyq.exam_name).toBeTruthy();
      }

      // Spot check diagrams: verify at least one candidate with a figure captures diagram_url / metadata
      const diagramCandidates = candidates.filter((c) => !!c.diagram_url);
      expect(diagramCandidates.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Matrix 2: Named Reference PDF — Chemical Bonding and Molecular Structure — JEE Main 2026 (Jan) — MathonGo", () => {
    it("extracts all 13 questions with real chemical formulas and valid answers", async () => {
      const chemPdfPath = path.resolve(fixturesDir, "chemical_bonding.pdf");
      if (!fs.existsSync(chemPdfPath)) {
        throw new Error("Fixture chemical_bonding.pdf not found; please supply the file.");
      }

      const pdfBuffer = fs.readFileSync(chemPdfPath);
      const candidates = await extractionService.extractFromPdf(
        pdfBuffer,
        "Chemical_Bonding_and_Molecular_Structure_-_JEE_Main_2026__Jan__-_MathonGo.pdf"
      );

      expect(candidates.length).toBe(13);

      // Verify Q1 statements have their real chemical formulas restored
      const q1 = candidates[0];
      expect(q1.question_text).toContain("Cl2 > Br2 > F2 > I2");
      expect(q1.question_text).toContain("[SnCl4 > SnCl2]");
      expect(q1.question_text).toContain("[PbCl4 > PbCl2]");
      expect(q1.question_text).toContain("[UF4 > UF6]");
      expect(q1.options.length).toBe(4);
      expect(q1.correct_answer).toBe("Statement I is true but Statement II is false");

      // Verify Q2 has reconstructed formulas in stem and options
      const q2 = candidates[1];
      expect(q2.question_text).toContain("C − H");
      expect(q2.options.length).toBe(4);
      expect(q2.options[0].text).toContain("D < C < A < B");

      // Verify Q3 has central molecule and bond angles
      const q3 = candidates[2];
      expect(q3.question_text).toContain("HNO3, H2SO4, NF3");
      expect(q3.options.length).toBe(4);
      expect(q3.options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: "116∘" }),
          expect.objectContaining({ text: "102∘" }),
          expect.objectContaining({ text: "107∘" }),
          expect.objectContaining({ text: "120∘" }),
        ])
      );

      // Verify Q5 options have proper chemical species
      const q5 = candidates[4];
      expect(q5.options.length).toBe(4);
      expect(q5.options[0].text).toContain("O2 −, N2 +");
      expect(q5.options[3].text).toContain("O2 +, N2 −");

      // Verify clean candidates have valid options
      const cleanCandidates = candidates.filter((c) => c.options.length >= 2);
      expect(cleanCandidates.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("Matrix 2b: Positional Fragment Reattachment & Footer Detection Unit Tests", () => {
    it("matches footer boundary on both Chemical Bonding and Work Power Energy regardless of chapter name", () => {
      const cbFooterText = "Q1. Question text here\nChemical Bonding and Molecular Structure\nQuestions with Answer Keys\nJEE Main 2026 (January) Question Bank\nMathonGo\n#PaperPhodnaHai\nwww.mathongo.com\nCl2 > Br2 > F2 > I2";
      const wpeFooterText = "Q1. Question text here\nWork Power Energy\nQuestions with Answer Keys\nJEE Main 2026 (January) Question Bank\nMathonGo\n#PaperPhodnaHai\nwww.mathongo.com\n1/5\n3/5";
      const otherChapterText = "Q1. Question text here\nRotational Motion\nQuestions with Answer Keys\nJEE Main 2026 (January) Question Bank\nMathonGo\n#PaperPhodnaHai\nwww.mathongo.com\nFloating math";

      const matchCb = cbFooterText.match(FOOTER_WATERMARK_PATTERN);
      const matchWpe = wpeFooterText.match(FOOTER_WATERMARK_PATTERN);
      const matchOther = otherChapterText.match(FOOTER_WATERMARK_PATTERN);

      expect(matchCb).not.toBeNull();
      expect(matchWpe).not.toBeNull();
      expect(matchOther).not.toBeNull();

      expect(cbFooterText.slice(0, matchCb!.index).trim()).toBe("Q1. Question text here");
      expect(wpeFooterText.slice(0, matchWpe!.index).trim()).toBe("Q1. Question text here");
      expect(otherChapterText.slice(0, matchOther!.index).trim()).toBe("Q1. Question text here");
    });

    it("correctly reconstructs Q1 two statements exactly with formulas", () => {
      const rawSection = "Statement I : The correct order in terms of bond dissociation enthalpy is \t.\nStatement II: The correct trend in the covalent character of the metal halides is \t,\nand \t.";
      const fragments = ["Cl2 > Br2 > F2 > I2", "[SnCl4 > SnCl2]", "[PbCl4 > PbCl2]", "[UF4 > UF6]"];

      const reconstructed = reattachDisplacedFragments(rawSection, fragments);

      expect(reconstructed).toContain("Statement I : The correct order in terms of bond dissociation enthalpy is Cl2 > Br2 > F2 > I2.");
      expect(reconstructed).toContain("Statement II: The correct trend in the covalent character of the metal halides is [SnCl4 > SnCl2], [PbCl4 > PbCl2] and [UF4 > UF6].");
    });

    it("handles mismatched gap and fragment counts gracefully without crashing", () => {
      // More gaps than fragments
      const textWithManyGaps = "Statement I is \t and Statement II is \t and Statement III is \t.";
      const fewFragments = ["Formula A"];
      const res1 = reattachDisplacedFragments(textWithManyGaps, fewFragments);
      expect(res1).toContain("Statement I is Formula A");
      expect(typeof res1).toBe("string");

      // Fewer gaps than fragments (extra fragments ignored without error)
      const textWithOneGap = "Statement I is \t.";
      const manyFragments = ["Formula A", "Formula B", "Formula C"];
      const res2 = reattachDisplacedFragments(textWithOneGap, manyFragments);
      expect(res2).toBe("Statement I is Formula A.");

      // Empty inputs
      expect(reattachDisplacedFragments("", [])).toBe("");
      expect(reattachDisplacedFragments("Normal text", [])).toBe("Normal text");
    });
  });

  describe("Matrix 3: Multi-Column and Complex Layout Segmentation", () => {
    it("correctly segments interleaved stem and numbered options across line breaks", async () => {
      const syntheticMultiColumnText = `
SECTION A: MULTI-COLUMN QUESTIONS
Q1. An electron moves in a uniform magnetic field B with velocity v perpendicular to B.
(1) Circular path with radius r = mv/qB
(2) Helical path with pitch p = 2pi*m*v_parallel/qB
(3) Parabolic trajectory
(4) Linear straight line motion

Q2. What is the efficiency of a Carnot engine operating between 500K and 300K?
(1) 40%
(2) 60%
(3) 20%
(4) 80%

Answer Key:
1-(1)
2-(1)
`;

      const candidates = await extractionService.parseCandidatesFromText(
        syntheticMultiColumnText,
        "multi_column_test.pdf"
      );

      expect(candidates.length).toBe(2);
      expect(candidates[0].question_text).toContain("An electron moves in a uniform magnetic field");
      expect(candidates[0].options.length).toBe(4);
      expect(candidates[0].correct_answer).toBe("Circular path with radius r = mv/qB");
      expect(candidates[0].confidence).toBe("HIGH");

      expect(candidates[1].question_text).toContain("efficiency of a Carnot engine");
      expect(candidates[1].options.length).toBe(4);
      expect(candidates[1].correct_answer).toBe("40%");
      expect(candidates[1].confidence).toBe("HIGH");
    });
  });

  describe("Matrix 4: Chemistry Formulas & Notation Fidelity", () => {
    it("preserves chemical formulas, superscripts, and subscripts without corruption", async () => {
      const chemistryText = `
Questions
Q1. Identify the hybridization of central atom in XeF4 and SF6 respectively:
(1) sp3d2 and sp3d2
(2) sp3d and sp3d2
(3) sp3 and dsp2
(4) d2sp3 and sp3d

Q2. Calculate the oxidation state of Cr in K2Cr2O7 and Mn in KMnO4:
(1) +6 and +7
(2) +3 and +4
(3) +6 and +2
(4) +4 and +7

Answer Key
Q1. (1)
Q2. (1)
`;

      const candidates = await extractionService.parseCandidatesFromText(
        chemistryText,
        "chemistry_bonding.pdf"
      );

      expect(candidates.length).toBe(2);
      expect(candidates[0].question_text).toContain("XeF4");
      expect(candidates[0].question_text).toContain("SF6");
      expect(candidates[0].options[0].text).toBe("sp3d2 and sp3d2");
      expect(candidates[0].correct_answer).toBe("sp3d2 and sp3d2");

      expect(candidates[1].question_text).toContain("K2Cr2O7");
      expect(candidates[1].question_text).toContain("KMnO4");
      expect(candidates[1].options[0].text).toBe("+6 and +7");
      expect(candidates[1].correct_answer).toBe("+6 and +7");
    });
  });

  describe("Matrix 5: Missing or Ambiguous Answer Keys", () => {
    it("flags needsReview and LOW confidence gracefully when answer key is absent", async () => {
      const textWithoutAnswers = `
Questions
Q1. What is the unit of electric flux in SI units?
(1) N m^2 C^-1
(2) V m
(3) Both (1) and (2)
(4) J C^-1

Q2. State Lenz's Law of electromagnetic induction.
(1) Conserves energy
(2) Conserves momentum
(3) Conserves charge
(4) Conserves angular momentum
`;

      const candidates = await extractionService.parseCandidatesFromText(
        textWithoutAnswers,
        "unanswered_questions.pdf"
      );

      expect(candidates.length).toBe(2);
      for (const cand of candidates) {
        expect(cand.needsReview).toBe(true);
        expect(cand.correct_answer).toBe("");
        expect(cand.confidence).toBe("LOW");
        expect(cand.reviewReason).toContain("Missing correct answer");
      }
    });

    it("flags candidate with malformed option structure for human review", async () => {
      const textWithMalformedOptions = `
Questions
Q1. A simple pendulum oscillates with period T.
Only one option given: (1) T = 2pi*sqrt(L/g)

Answer Key
1-(1)
`;

      const candidates = await extractionService.parseCandidatesFromText(
        textWithMalformedOptions,
        "malformed_options.pdf"
      );

      expect(candidates.length).toBe(1);
      const cand = candidates[0];
      expect(cand.needsReview).toBe(true);
      expect(cand.confidence).toBe("LOW");
      expect(cand.reviewReason).toMatch(/options/i);
    });
  });

  describe("Matrix 6: Empty or Scanned PDF Error Handling", () => {
    it("rejects empty or whitespace-only PDF buffer with a descriptive error", async () => {
      const emptyBuffer = Buffer.from("");
      await expect(
        extractionService.extractFromPdf(emptyBuffer, "empty.pdf")
      ).rejects.toThrow(/invalid file signature|empty|scanned/i);
    });
  });
});
