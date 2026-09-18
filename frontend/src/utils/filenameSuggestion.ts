/**
 * Suggests a clean Chapter name from an uploaded file name
 * e.g., "Work_Power_Energy_-_JEE_Main_2026__Jan__-_MathonGo.pdf" -> "Work Power Energy"
 */
export function suggestChapterName(filename?: string): string {
  if (!filename) return "";

  // 1. Strip file extension
  let name = filename.replace(/\.[^/.]+$/, "");

  // 2. Replace underscores, hyphens, plus signs with spaces
  name = name.replace(/[_\-+]+/g, " ");

  // 3. Strip exam names, brandings, months, year tags, and question bank suffixes
  name = name.replace(/\b(?:JEE\s*(?:Main|Advanced)?|NEET|GATE|ISRO|UGC\s*NET|CAT|IES|ESE|BITSAT)\b.*$/i, "");
  name = name.replace(/\b(?:MathonGo|Allen|Resonance|Aakash|PhysicsWallah|PW)\b.*$/i, "");
  name = name.replace(/\b(?:Question\s*Bank|PYQ|Solutions?|Answers?|Module|Chapter)\b.*$/i, "");
  name = name.replace(/\b\d{4}\b/g, ""); // 4-digit years
  name = name.replace(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\b/gi, "");
  name = name.replace(/[()[\]{}]/g, " ");

  // 4. Normalize spaces and trim
  return name.replace(/\s+/g, " ").trim();
}
