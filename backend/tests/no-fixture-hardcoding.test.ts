import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Anti-Hardcoding Structural Guard (PROMPT 1 & PROMPT 9)", () => {
  const extractionServicePath = path.resolve(
    __dirname,
    "../src/modules/ingestion/extraction.service.ts"
  );
  const extractionServiceSource = fs.readFileSync(extractionServicePath, "utf-8");

  it("does not contain questionNumber-specific fallback branches", () => {
    // Guards against: pq.questionNumber === 2 / 3 / 5 / 6 etc.
    const questionNumberBranchRegex = /(?:pq|q|candidate|item)\.questionNumber\s*===/i;
    expect(questionNumberBranchRegex.test(extractionServiceSource)).toBe(false);
  });

  it("does not contain fixture-specific literal option overrides or text constants", () => {
    // Guards against hardcoded option values from Work Power Energy or Chemical Bonding fixtures
    expect(extractionServiceSource).not.toContain("Work Power Energy");
    expect(extractionServiceSource).not.toContain("Chemical Bonding");
    expect(extractionServiceSource).not.toContain("finalOptions = [{ text: '1/5'");
  });

  it("does not strip legitimate chapter or academic terms in DEFAULT_WATERMARK_PATTERNS", () => {
    // Ensure watermark patterns don't strip subject names or chapter topics
    const watermarkSectionMatch = extractionServiceSource.match(
      /DEFAULT_WATERMARK_PATTERNS\s*=\s*\[([\s\S]*?)\];/
    );
    expect(watermarkSectionMatch).not.toBeNull();
    const watermarkBlock = watermarkSectionMatch ? watermarkSectionMatch[1] : "";

    expect(watermarkBlock).not.toContain("Work Power Energy");
    expect(watermarkBlock).not.toContain("Chemical Bonding");
    expect(watermarkBlock).not.toContain("Physics");
    expect(watermarkBlock).not.toContain("Chemistry");
    expect(watermarkBlock).not.toContain("Mathematics");
  });

  it("does not contain hardcoded answer keys for specific test fixtures", () => {
    // Guards against oracle mappings hardcoded into service logic
    expect(extractionServiceSource).not.toMatch(/Q1\s*->\s*3/i);
    expect(extractionServiceSource).not.toMatch(/Q13\s*->\s*3/i);
    expect(extractionServiceSource).not.toMatch(/const\s+ANSWER_KEY_FIXTURE/i);
  });
});
