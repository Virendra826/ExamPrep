import crypto from 'crypto';
import * as pdfParseModule from 'pdf-parse';
import { CandidateQuestion } from './ingestion.types.js';
import { scoreConfidence } from './confidence.js';
import { getVisionProvider } from './vision/index.js';
import { renderPageToImage } from './pageRenderer.js';

export interface SectionBoundaryResult {
  questionsText: string;
  solutionsText: string | null;
  boundaryOffset: number | null;
}

export const DEFAULT_SOLUTION_HEADINGS = [
  'ANSWERS AND SOLUTIONS',
  'ANSWERS & SOLUTIONS',
  'ANSWER KEY AND SOLUTIONS',
  'ANSWER KEY & SOLUTIONS',
  'ANSWERS AND HINTS',
  'ANSWERS & HINTS',
  'ANSWER KEY',
  'SOLUTIONS & EXPLANATIONS',
  'SOLUTIONS AND EXPLANATIONS',
  'SOLUTIONS',
  'HINTS AND SOLUTIONS',
  'HINTS & SOLUTIONS',
];

/**
 * 1. Section-boundary detector:
 * Identifies the offset where the answers & solutions section begins.
 * Everything from that offset onward is excluded from question candidate generation.
 */
export function detectSectionBoundary(
  text: string,
  headings: string[] = DEFAULT_SOLUTION_HEADINGS
): SectionBoundaryResult {
  if (!text) {
    return { questionsText: '', solutionsText: null, boundaryOffset: null };
  }

  const escapedHeadings = headings.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  const boundaryRegex = new RegExp(`(?:^|\\n)\\s*(?:${escapedHeadings.join('|')})\\b`, 'i');

  const match = boundaryRegex.exec(text);
  if (match) {
    const boundaryOffset = match.index;
    const questionsText = text.slice(0, boundaryOffset).trim();
    const solutionsText = text.slice(boundaryOffset).trim();
    return { questionsText, solutionsText, boundaryOffset };
  }

  return { questionsText: text.trim(), solutionsText: null, boundaryOffset: null };
}

export const DEFAULT_WATERMARK_PATTERNS = [
  /https?:\/\/\S+/gi,
  /www\.mathongo\.com/gi,
  /#PaperPhodnaHai/gi,
  /\bmathongo\b/gi,
  /--\s*\d+\s+of\s+\d+\s*--/gi,
  /Questions with Answer Keys/gi,
];

/**
 * 4. Watermark-safe text cleanup:
 * Targeted removal of known repeated watermark tokens/patterns without removing
 * legitimate adjacent numeric or variable symbols (e.g. m = 2 kg, t = 2 s, vi = 5 m/s).
 */
export function cleanWatermarks(
  text: string,
  customPatterns: (string | RegExp)[] = DEFAULT_WATERMARK_PATTERNS
): string {
  if (!text) return '';

  let cleaned = text;
  for (const pattern of customPatterns) {
    if (typeof pattern === 'string') {
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '');
    } else {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  // Normalize excessive horizontal whitespace (preserving single space)
  cleaned = cleaned.replace(/[ \t]+/g, ' ');

  // Clean empty lines and trim each line
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

  return cleaned.trim();
}

/**
 * 5. Cross-validation of Question/Answer/Option consistency (PROMPT 6):
 * Confirms that resolved correct_answer matches one of the resolved options.
 * Detects answer disagreements between text and vision.
 * Never throws — attaches reviewReason and adjusts confidence.
 */
export function crossValidateCandidate(
  candidate: CandidateQuestion,
  extra?: { deterministicAnswer?: string; visionAnswer?: string }
): void {
  // Check if text and vision answers both exist and disagree
  if (
    extra?.deterministicAnswer &&
    extra?.visionAnswer &&
    extra.deterministicAnswer !== extra.visionAnswer
  ) {
    candidate.confidence = 'LOW';
    candidate.needsReview = true;
    candidate.reviewReason = 'Text-based and vision-based extraction disagree on the correct answer.';
    return;
  }

  // Check if candidate has fewer than 2 valid options
  if (candidate.options.length < 2) {
    candidate.confidence = 'LOW';
    candidate.needsReview = true;
    if (!candidate.reviewReason) {
      candidate.reviewReason = 'Fewer than 2 valid options extracted — please verify manually.';
    }
    return;
  }

  // Check if correct_answer is missing
  if (!candidate.correct_answer) {
    candidate.confidence = 'LOW';
    candidate.needsReview = true;
    if (!candidate.reviewReason) {
      candidate.reviewReason = 'Missing correct answer — please verify manually.';
    }
    return;
  }

  // Check if correct_answer matches one of the parsed options
  const hasMatchingOption = candidate.options.some((o) => o.text === candidate.correct_answer);
  if (!hasMatchingOption) {
    candidate.confidence = 'LOW';
    candidate.needsReview = true;
    if (!candidate.reviewReason) {
      candidate.reviewReason =
        'Detected answer does not match any parsed option — please verify manually.';
    }
  }
}

export interface ParsedOption {
  text: string;
  label: string;
  letter: string;
  index: number;
  startIndex?: number;
}

/**
 * 3. Options parser:
 * Parses both stacked multi-line options, inline single-line numbered/lettered options,
 * and mathematical symbol/root options.
 * Matches patterns like (1) 12 (2) 49 (3) 42 (4) 24 or (A) ... (B) ... (C) ... (D) ...
 */
export function parseOptions(rawText: string): ParsedOption[] {
  if (!rawText) return [];

  // Temporarily mask phrases like "marked as (1) to (4)", "from (1) to (4)" inside question stem
  const sanitizedText = rawText.replace(
    /(marked\s+as\s*|\bfrom\s*)\(([1-5A-Ea-e])\)\s*(?:to|-)\s*\(([1-5A-Ea-e])\)/gi,
    '$1[$2] to [$3]'
  );

  // Match all potential option markers: (1)..(5), (A)..(E), (a)..(e), A...E., A...E)
  const markerRegex =
    /(?:^|[\n\r\t]|\s{2,}|\s(?=\([1-5A-Ea-e]\)|[A-Ea-e][\.\)][ \t]))(?:\(([1-5]|[A-Ea-e])\)|([A-Ea-e])[\.\)])[ \t]*/g;

  const rawMatches: Array<{ label: string; startIndex: number; matchEndIndex: number; isNum: boolean }> = [];
  let m: RegExpExecArray | null;

  while ((m = markerRegex.exec(sanitizedText)) !== null) {
    const rawLabel = (m[1] || m[2]).trim();
    const isNum = /^\d+$/.test(rawLabel);
    const label = rawLabel.toUpperCase();
    const startIndex = m.index;
    const matchEndIndex = m.index + m[0].length;
    rawMatches.push({ label, startIndex, matchEndIndex, isNum });
  }

  if (rawMatches.length === 0) {
    // Check if the text consists of distinct stacked/tabbed lines (e.g. 2 to 6 lines)
    const lines = sanitizedText
      .split(/\n+|\t{2,}/)
      .map((l) => cleanWatermarks(l.trim()))
      .filter((l) => l.length > 0 && !/^(?:Questions with|MathonGo|#PaperPhodnaHai)/i.test(l));

    if (lines.length >= 2 && lines.length <= 6) {
      return lines.map((line, idx) => ({
        text: line,
        label: String(idx + 1),
        letter: String.fromCharCode(65 + idx),
        index: idx + 1,
      }));
    }
    return [];
  }

  // Find valid contiguous increasing sequences (e.g. 1->2->3->4 or A->B->C->D)
  const numMatches = rawMatches.filter((x) => x.isNum);
  const letterMatches = rawMatches.filter((x) => !x.isNum);

  const findConsecutive = (matches: typeof rawMatches) => {
    let best: typeof rawMatches = [];
    for (let i = 0; i < matches.length; i++) {
      const currentSeq = [matches[i]];
      let expectedNext = matches[i].isNum
        ? parseInt(matches[i].label, 10) + 1
        : matches[i].label.charCodeAt(0) + 1;

      for (let j = i + 1; j < matches.length; j++) {
        const candidate = matches[j];
        const val = candidate.isNum ? parseInt(candidate.label, 10) : candidate.label.charCodeAt(0);
        if (val === expectedNext) {
          currentSeq.push(candidate);
          expectedNext++;
        }
      }
      if (currentSeq.length > best.length) {
        best = currentSeq;
      }
    }
    return best;
  };

  const bestNum = findConsecutive(numMatches);
  const bestLetter = findConsecutive(letterMatches);

  let bestSequence: typeof rawMatches = [];
  // If there are numbered options (1)..(4), prioritize them over statement labels A..E
  if (bestNum.length >= 2) {
    bestSequence = bestNum;
  } else if (bestLetter.length >= 2) {
    bestSequence = bestLetter;
  } else {
    bestSequence = rawMatches;
  }

  const options: ParsedOption[] = [];

  for (let i = 0; i < bestSequence.length; i++) {
    const current = bestSequence[i];
    const nextStart = i + 1 < bestSequence.length ? bestSequence[i + 1].startIndex : sanitizedText.length;
    let optText = sanitizedText.slice(current.matchEndIndex, nextStart).trim();

    // Clean any trailing answer/solution/explanation tags if in the last option
    if (i === bestSequence.length - 1) {
      optText = optText.replace(/(?:Answer|Ans|Correct\s*Answer|Key|Explanation|Solution)[\s\S]*$/i, '').trim();
    }

    optText = cleanWatermarks(optText);

    const isNum = /^\d+$/.test(current.label);
    const index = isNum ? parseInt(current.label, 10) : current.label.charCodeAt(0) - 64;
    const letter = isNum ? String.fromCharCode(64 + index) : current.label;

    if (optText.length > 0) {
      options.push({ text: optText, label: current.label, letter, index, startIndex: current.startIndex });
    }
  }

  return options;
}

export interface SplitHeaderResult {
  questionNumber: number | null;
  headerLine: string | null;
  examName: string | null;
  examYear: number | null;
  stemText: string;
}

/**
 * 2. Question header vs. stem separation:
 * Extracts question number and exam metadata (e.g. "JEE Main 2026 (21 January Shift 2)")
 * separately from the actual question stem paragraph.
 */
export function splitHeaderAndStem(block: string): SplitHeaderResult {
  const trimmed = block.trim();
  if (!trimmed) {
    return { questionNumber: null, headerLine: null, examName: null, examYear: null, stemText: '' };
  }

  const lines = trimmed.split('\n');
  const firstLine = lines[0].trim();
  const restLines = lines.slice(1).join('\n').trim();

  // Match Q<N>. <Header/Metadata> or Question <N>: <Header/Metadata> or <N>. <Header/Metadata>
  const headerMatch = firstLine.match(/^(?:(?:Question|Q\.?)\s*(\d+)[:.]?|(\d+)[\.\)]\s*)(.*)$/i);

  if (headerMatch) {
    const questionNumber = parseInt(headerMatch[1] || headerMatch[2], 10);
    const rawHeaderRest = (headerMatch[3] || '').trim();

    // Check if rawHeaderRest looks like exam metadata or a pure header
    const examMatch = (rawHeaderRest || firstLine).match(/(JEE\s*(?:Main|Advanced)?|GATE|NEET|ISRO|UGC\s*NET|CAT|IES|ESE|BITSAT)[^\d\n]*(\d{4})(?:\s*\(([^)]+)\))?/i);

    // If there are subsequent lines and rawHeaderRest looks like a title/metadata header
    const isDedicatedHeader = Boolean(examMatch) && (!rawHeaderRest.includes('?') && (restLines.length > 0 || rawHeaderRest.length < 80));

    if (isDedicatedHeader) {
      // Fold exam name and shift/date into examName (e.g. "JEE Main 2026 (21 January Shift 2)")
      const examName = rawHeaderRest || (examMatch ? examMatch[0] : null);
      const examYear = examMatch ? parseInt(examMatch[2], 10) : null;
      return {
        questionNumber,
        headerLine: rawHeaderRest,
        examName,
        examYear,
        stemText: restLines,
      };
    } else {
      // The header rest is part of the question stem
      const examName = examMatch ? examMatch[1].trim() : null;
      const examYear = examMatch ? parseInt(examMatch[2], 10) : null;
      const stemText = [rawHeaderRest, restLines].filter(Boolean).join('\n').trim();
      return {
        questionNumber,
        headerLine: null,
        examName,
        examYear,
        stemText,
      };
    }
  }

  return {
    questionNumber: null,
    headerLine: null,
    examName: null,
    examYear: null,
    stemText: trimmed,
  };
}

/**
 * Parses the answer key table from the solutions section
 * (e.g. "1. (4) 2. (1) 3. (1) 4. (1) 5. (1) 6. (4)")
 */
export function parseAnswerKeyMap(solutionsText: string): Map<number, string> {
  const answerKeyMap = new Map<number, string>();
  if (!solutionsText) return answerKeyMap;

  const keyRegex = /(?:^|\s)(?:Q\.?\s*)?(\d+)[\.\:\-\)]\s*\(?([1-5A-Ea-e])\)?/gi;
  let km: RegExpExecArray | null;
  while ((km = keyRegex.exec(solutionsText)) !== null) {
    const qNum = parseInt(km[1], 10);
    const rawAns = km[2].toUpperCase();
    const numVal = parseInt(rawAns, 10);
    const ansLetter = !isNaN(numVal) ? String.fromCharCode(64 + numVal) : rawAns;
    if (!answerKeyMap.has(qNum) && qNum >= 1 && qNum <= 100) {
      answerKeyMap.set(qNum, ansLetter);
    }
  }
  return answerKeyMap;
}

export const FOOTER_WATERMARK_PATTERN =
  /(?:(?:\n|^)(?:[^\n]+\n)?Questions with Answer Keys[\s\S]*?(?:www\.mathongo\.com\b[^\n]*|https?:\/\/\S+|#PaperPhodnaHai\b[^\n]*)|(?:https?:\/\/\S+|www\.mathongo\.com\b[^\n]*|#PaperPhodnaHai\b[^\n]*|\bmathongo\b[^\n]*))/i;

export function extractFloatingFragments(bottomText: string): string[] {
  if (!bottomText) return [];
  const rawLines = bottomText.split(/\r?\n/);
  let currentTableBlock: string[] = [];

  const cleanedLines: string[] = [];
  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (
      /^(?:https?:\/\/\S+|www\.mathongo\.com|#PaperPhodnaHai|MathonGo|Questions with Answer Keys)/i.test(
        line
      )
    ) {
      continue;
    }
    cleanedLines.push(line);
  }

  // Merge only genuinely split formula lines where superscript/subscript split across lines
  // e.g. "SF4, NH+" followed by "4 , [NiCl4]..." or "O-" followed by "2 , O2 2-, F2"
  const mergedLines: string[] = [];
  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];
    const nextLine = cleanedLines[i + 1];

    const isSplitSubscript = Boolean(
      nextLine &&
        (/[A-Za-z]\s*[\+\-−]\s*$/.test(line) && /^\s*[0-9]\s*,\s*/.test(nextLine)) ||
        /^[0-9]\s*d\)/i.test(nextLine || '')
    );

    if (nextLine && isSplitSubscript) {
      mergedLines.push(line + ' ' + nextLine);
      i++; // skip nextLine
    } else {
      mergedLines.push(line);
    }
  }

  const fragments: string[] = [];
  for (const line of mergedLines) {
    // Check if this line is part of a List-I / List-II or Column matching table
    const isTableLine = /^(?:List\s*[-–—I0-9]|Column\s*[-–—I0-9]|[A-D]\.\s*|I{1,3}\.\s*|IV\.\s*)/i.test(
      line
    );
    if (isTableLine) {
      currentTableBlock.push(line);
      continue;
    }
    if (currentTableBlock.length > 0) {
      fragments.push(currentTableBlock.join('\n'));
      currentTableBlock = [];
    }

    if (line.includes('\t')) {
      const parts = line
        .split('\t')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
      fragments.push(...parts);
    } else {
      fragments.push(line);
    }
  }

  if (currentTableBlock.length > 0) {
    fragments.push(currentTableBlock.join('\n'));
  }

  return fragments;
}

/**
 * Pure positional mechanism that reattaches inline mathematical/chemical content
 * that pdf-parse displaced to the floating block, using gap markers as anchor points.
 */
export function reattachDisplacedFragments(
  sectionText: string,
  floatingFragments: string[]
): string {
  if (!sectionText || !floatingFragments || floatingFragments.length === 0) {
    return sectionText || '';
  }

  let text = sectionText;

  // 1. Protect tabs between already-filled options so they don't get treated as missing gaps
  text = text.replace(
    /(\([1-5A-Ea-e]\)[ \t]*[^\t\n\r]+?)[ \t]*\t[ \t]*(?=\([1-5A-Ea-e]\))/g,
    (match, p1) => {
      const inner = p1.replace(/^\([1-5A-Ea-e]\)/, '').trim();
      if (!inner || inner.toLowerCase() === 'and' || inner.toLowerCase() === 'both') {
        return match;
      }
      return p1 + '  ';
    }
  );

  // 2. Missing Match List / Match Column table gap:
  text = text.replace(
    /(Match\s+(?:List|Column)[^\n]*\n)(?=[ \t]*Choose\s+the\s+correct\s+answer)/gi,
    '$1\t\n'
  );

  // 3. Incomplete options with 'Both': "(2) Both" -> "(2) Both \t"
  text = text.replace(
    /(\bBoth\b)(?![ \t]*\t)[ \t]*(?=(?:\([1-5A-Ea-e]\)|[A-Ea-e][\.\)]|$|\r?\n))/gi,
    '$1 \t '
  );

  // 4. Missing subject between 'and' and 'is/are': "and \n is a" -> "and \t is a"
  text = text.replace(/\band[ \t\r\n]+(is|are)\s+(?:a|an)\b/gi, 'and \t $1 ');

  // 5. Bare punctuation after keywords: "is .", "and ."
  text = text.replace(/\b(and|to|is|are|of|in|for|from|=|:)[ \t]+([.,;])/gi, '$1 \t$2');
  text = text.replace(
    /\b(molecule|atom|species|compound|ion|radical|element)[ \t]+([.,;])/gi,
    '$1 \t$2'
  );

  // 6. Comma before 'and' with missing list element: ", and" -> ", \t and"
  text = text.replace(/,([ \t]*\r?\n?[ \t]*)and\b/gi, ', \t and');

  // 7. Empty option markers without existing tab: "(1) (2)" or "(2)\n"
  text = text.replace(
    /(?:^|[\s\r\n])(?:\(([1-5]|[A-Ea-e])\)|([A-Ea-e])[\.\)])(?![ \t]*\t)[ \t]*(?=(?:\([1-5A-Ea-e]\)|[A-Ea-e][\.\)]|$|\r?\n))/g,
    '$& \t '
  );

  // Collapse multiple tabs into a single tab placeholder
  text = text.replace(/\t+/g, '\t');

  // 8. Walk through text replacing each gap '\t' sequentially with next unused fragment
  let fragIdx = 0;
  let result = text.replace(/([^\s\t])?\t([^\s\t])?/g, (_match, before, after) => {
    if (fragIdx < floatingFragments.length) {
      const frag = floatingFragments[fragIdx++];
      const prefix = before ? `${before} ` : '';
      const suffix = after ? (/[.,;]/.test(after) ? after : ` ${after}`) : '';
      return `${prefix}${frag}${suffix}`;
    }
    return (before || '') + (after || '');
  });

  // Ensure whitespace separation before inline option markers
  result = result.replace(/([^\s])(\([1-5A-Ea-e]\))/g, '$1 $2');
  result = result.replace(/[ \t]+([.,;])/g, '$1');
  result = result.replace(/[ \t]{2,}/g, ' ');

  return result;
}

export class ExtractionService {
  // Validate PDF file magic header (%PDF-)
  validatePdfSignature(buffer: Buffer): boolean {
    if (!buffer || buffer.length < 5) return false;
    const header = buffer.subarray(0, 5).toString('ascii');
    return header.startsWith('%PDF-');
  }

  // Extract raw text from PDF buffer
  async extractTextFromPdf(buffer: Buffer): Promise<string> {
    if (!this.validatePdfSignature(buffer)) {
      throw new Error('Invalid file signature: not a valid PDF document');
    }

    try {
      // Handle both pdf-parse v1 (function) and v2 (class PDFParse)
      const moduleObj = pdfParseModule as unknown as Record<string, unknown>;
      const P = (moduleObj.PDFParse || (moduleObj.default as Record<string, unknown> | undefined)?.PDFParse) as
        | { new (options: { data: Buffer }): { load(): Promise<void>; getText(): Promise<{ text?: string } | string>; destroy?(): Promise<void> } }
        | undefined;

      if (typeof P === 'function') {
        const parser = new P({ data: buffer });
        try {
          await parser.load();
          const result = await parser.getText();
          return typeof result === 'string' ? result : result?.text || '';
        } finally {
          if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => {});
          }
        }
      } else {
        // Fallback for function-based pdf-parse
        const fn = typeof pdfParseModule === 'function' ? pdfParseModule : (moduleObj.default as ((buf: Buffer) => Promise<{ text?: string }>));
        const result = await fn(buffer);
        return result.text || '';
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/password|encrypted/i.test(msg)) {
        throw new Error('PDF is encrypted or password-protected');
      }
      if (/corrupt|invalid|structure/i.test(msg)) {
        throw new Error('Invalid or corrupted PDF file');
      }
      throw new Error(`PDF extraction failed: ${msg}`);
    }
  }

  /**
   * Complete page-aware visual and text extraction from PDF buffer
   */
  async extractFromPdf(buffer: Buffer, _originalFilename?: string): Promise<CandidateQuestion[]> {
    if (!this.validatePdfSignature(buffer)) {
      throw new Error('Invalid file signature: not a valid PDF document');
    }

    let rawPages: Array<{ text: string; pageNumber: number }> = [];
    let rawImagesPages: Array<{ pageNumber: number; images: Array<{ dataUrl?: string; name: string }> }> = [];

    const moduleObj = pdfParseModule as unknown as Record<string, unknown>;
    const P = (moduleObj.PDFParse || (moduleObj.default as Record<string, unknown> | undefined)?.PDFParse) as
      | {
          new (options: { data: Buffer }): {
            load(): Promise<void>;
            getText(): Promise<{ pages?: Array<{ text?: string }> } | string>;
            getImage?(): Promise<{ pages?: Array<{ pageNumber: number; images?: Array<{ dataUrl?: string; name: string }> }> } | null>;
            destroy?(): Promise<void>;
          };
        }
      | undefined;

    if (typeof P === 'function') {
      const parser = new P({ data: buffer });
      try {
        await parser.load();
        const textRes = await parser.getText();
        const imagesRes = typeof parser.getImage === 'function' ? await parser.getImage() : null;

        if (typeof textRes === 'object' && textRes?.pages) {
          rawPages = textRes.pages.map((p, idx: number) => ({
            text: p.text || '',
            pageNumber: idx + 1,
          }));
        } else {
          rawPages = [{ text: typeof textRes === 'string' ? textRes : (textRes as { text?: string })?.text || '', pageNumber: 1 }];
        }

        if (imagesRes?.pages) {
          rawImagesPages = imagesRes.pages.map((p) => ({
            pageNumber: p.pageNumber,
            images: p.images || [],
          }));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/password|encrypted/i.test(msg)) {
          throw new Error('PDF is encrypted or password-protected');
        }
        if (/corrupt|invalid|structure/i.test(msg)) {
          throw new Error('Invalid or corrupted PDF file');
        }
        throw new Error(`PDF extraction failed: ${msg}`);
      } finally {
        if (typeof parser.destroy === 'function') {
          await parser.destroy().catch(() => {});
        }
      }
    } else {
      const rawText = await this.extractTextFromPdf(buffer);
      return this.parseCandidatesFromText(rawText);
    }

    // Detect section boundary across the whole document
    const fullText = rawPages.map((p) => p.text).join('\n');
    const { boundaryOffset, solutionsText } = detectSectionBoundary(fullText);
    const answerKeyMap = parseAnswerKeyMap(solutionsText || '');

    // Filter out pages that belong to the solutions section
    let currentOffset = 0;
    const questionPages: Array<{ text: string; pageNumber: number; images: Array<{ dataUrl?: string; name: string }> }> = [];

    for (const page of rawPages) {
      const pageLen = page.text.length;
      const pageImgs = rawImagesPages.find((p) => p.pageNumber === page.pageNumber)?.images || [];

      if (boundaryOffset !== null && currentOffset >= boundaryOffset) {
        break;
      }

      if (boundaryOffset !== null && currentOffset + pageLen > boundaryOffset) {
        const pageCut = boundaryOffset - currentOffset;
        const pageQuestionsText = page.text.slice(0, pageCut);
        questionPages.push({
          text: pageQuestionsText,
          pageNumber: page.pageNumber,
          images: pageImgs,
        });
        break;
      } else {
        questionPages.push({
          text: page.text,
          pageNumber: page.pageNumber,
          images: pageImgs,
        });
      }
      currentOffset += pageLen + 1;
    }

    const candidates: CandidateQuestion[] = [];

    for (const qPage of questionPages) {
      const pageText = qPage.text;

      // Split page into questions section and bottom math layer (around vendor watermark)
      const wmMatch = pageText.match(FOOTER_WATERMARK_PATTERN);
      let topSection = pageText;
      let bottomMathSection = '';

      if (wmMatch && wmMatch.index !== undefined) {
        topSection = pageText.slice(0, wmMatch.index).trim();
        bottomMathSection = pageText.slice(wmMatch.index + wmMatch[0].length).trim();
      }

      // Reattach displaced inline mathematical/chemical formulas into topSection before question segmentation
      const floatingFragments = extractFloatingFragments(bottomMathSection);
      if (floatingFragments.length > 0) {
        topSection = reattachDisplacedFragments(topSection, floatingFragments);
      }

      const delimiterPattern = /(?:^|\n+)(?=(?:(?:Question|Q\.?)\s*\d+[:.]?|\d+[.)]\s+))/i;
      const blocks = topSection.split(delimiterPattern).map((b) => b.trim()).filter((b) => b.length > 0);

      const pageQuestions: Array<{
        block: string;
        questionNumber: number | null;
        headerLine: string | null;
        examName: string | null;
        examYear: number | null;
        stemText: string;
        options: ReturnType<typeof parseOptions>;
        imageIndex?: number;
      }> = [];

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const { questionNumber, headerLine, examName, examYear, stemText } = splitHeaderAndStem(block);
        const options = parseOptions(stemText);

        // Skip preamble / section header blocks that have no question number, no options, and are purely section headers
        if (
          questionNumber === null &&
          options.length === 0 &&
          (stemText.length < 20 || /^(?:Questions|Section\s+[A-Z0-9]|Part\s+[A-Z0-9]|General\s+Instructions)/i.test(stemText.trim()))
        ) {
          continue;
        }

        pageQuestions.push({
          block,
          questionNumber,
          headerLine,
          examName,
          examYear,
          stemText,
          options,
        });
      }

      // Allocate images on this page only to questions that explicitly reference figures/graphs/structures
      let nextImgIdx = 0;
      for (const pq of pageQuestions) {
        const isStatementOnly = /Given below are two statements|Statement I:/i.test(pq.stemText);
        const mentionsVisual =
          !isStatementOnly &&
          /(?:figure|diagram|graph|track|as shown|shown in|semi-circular|circular|bead|string|rod|pivot|bob|Lewis\s+representation|Lewis\s+structure|representation\s+of|structure\s+of|marked\s+as\s*\[\d+\]|marked\s+as\s*\(\d+\)|marked\s+as\s*[A-D]|atoms\s+marked)/i.test(
            pq.stemText
          );
        if (mentionsVisual && nextImgIdx < qPage.images.length) {
          pq.imageIndex = nextImgIdx;
          nextImgIdx++;
        }
      }

      // Process each question on this page
      for (const pq of pageQuestions) {
        let finalStem = pq.stemText;
        let finalOptions = pq.options;

        // Reconstruct options if empty markers or split into bottom math section
        const hasProperOptions =
          finalOptions.length >= 2 &&
          new Set(finalOptions.map((o) => o.text.trim())).size === finalOptions.length &&
          finalOptions.every((o) => {
            const t = o.text.trim();
            return t.length > 0 && !t.startsWith('(') && (t.length > 1 || /^\d+$/.test(t)) && !/^[A-Za-z]$/.test(t);
          });

        if (!hasProperOptions) {
          if (bottomMathSection) {
            const recovered = parseOptions(bottomMathSection);
            if (
              recovered.length >= 2 &&
              new Set(recovered.map((o) => o.text.trim())).size === recovered.length &&
              recovered.every((o) => {
                const t = o.text.trim();
                return t.length > 0 && !t.startsWith('(') && (t.length > 1 || /^\d+$/.test(t)) && !/^[A-Za-z]$/.test(t);
              })
            ) {
              finalOptions = recovered;
            } else {
              finalOptions = [];
            }
          } else {
            finalOptions = [];
          }
        }

        // Clean stem of option markers based on first option marker
        if (finalOptions.length > 0 && finalOptions[0].startIndex !== undefined) {
          finalStem = finalStem.slice(0, finalOptions[0].startIndex).trim();
        } else if (finalOptions.length > 0) {
          const firstOptLabel = finalOptions[0].label;
          const isNum = /^\d+$/.test(firstOptLabel);
          const firstOptPattern = isNum
            ? new RegExp(`(?:^|[\\n\\r\\t]|\\s{2,}|\\s(?=\\(${firstOptLabel}\\)|${firstOptLabel}[\\.\\)][ \\t]))(?:\\(${firstOptLabel}\\)|${firstOptLabel}[\\.\\)])[ \\t]*`)
            : /(?:^|[\n\r\t]|\s{2,}|\s(?=\([1-5A-Ea-e]\)|[A-Ea-e][.)][ \t]))(?:\(([1-5]|[A-Ea-e])\)|([A-Ea-e])[.)])[ \t]*/;
          const firstOptIndex = finalStem.search(firstOptPattern);
          if (firstOptIndex !== -1) {
            finalStem = finalStem.slice(0, firstOptIndex).trim();
          }
        }
        finalStem = cleanWatermarks(finalStem);

        // Diagram association: preserve diagramUrl in candidate without polluting question text
        let diagramUrl: string | null = null;
        if (pq.imageIndex !== undefined && qPage.images[pq.imageIndex]?.dataUrl) {
          diagramUrl = qPage.images[pq.imageIndex].dataUrl!;
        }

        // Sanitize finalStem to ensure no raw data:image payloads exist in question text
        finalStem = finalStem.replace(/!\[.*?\]\(data:image\/[^)]+\)/gi, '').replace(/data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+/gi, '').trim();

        // Resolve correct answer
        const detectedAnsLetter = pq.questionNumber ? answerKeyMap.get(pq.questionNumber) : '';
        let resolvedCorrectAnswer = '';
        if (detectedAnsLetter) {
          const matched = finalOptions.find((o) => o.letter === detectedAnsLetter);
          if (matched) {
            resolvedCorrectAnswer = matched.text;
          } else {
            resolvedCorrectAnswer = detectedAnsLetter;
          }
        } else if (finalOptions.length > 0) {
          resolvedCorrectAnswer = finalOptions[0].text;
        }

        const hasAnswer = Boolean(resolvedCorrectAnswer);
        const hasText = finalStem.length >= 5;
        const hasAnswerKeyMatch = Boolean(
          detectedAnsLetter && finalOptions.some((o) => o.letter === detectedAnsLetter)
        );
        const hasProperOptionTexts =
          finalOptions.length >= 2 &&
          new Set(finalOptions.map((o) => o.text.trim())).size === finalOptions.length &&
          finalOptions.every((o) => {
            const t = o.text.trim();
            return t.length > 0 && !t.startsWith('(') && (t.length > 1 || /^\d+$/.test(t)) && !/^[A-Za-z]$/.test(t);
          });

        const confidence = scoreConfidence({
          optionCount: finalOptions.length,
          hasProperOptionTexts,
          hasStemText: hasText,
          hasAnswer,
          hasAnswerKeyMatch,
          hasUnresolvedMarkersInStem: /\([1-5A-Ea-e]\)/.test(finalStem),
        });

        const needsReview = confidence !== 'HIGH';
        const isPYQ = Boolean(pq.examName || pq.examYear);

        candidates.push({
          id: `cand-${crypto.randomUUID()}`,
          question_text: finalStem,
          options: finalOptions.map((o) => ({ text: o.text })),
          correct_answer: resolvedCorrectAnswer,
          explanation: null,
          question_type: isPYQ ? 'PYQ' : 'CONCEPT',
          difficulty: null,
          status: needsReview ? 'DRAFT' : 'ACTIVE',
          exam_name: pq.examName,
          exam_year: pq.examYear,
          needsReview,
          confidence,
          extractionMethod: 'TEXT',
          sourcePages: [qPage.pageNumber],
          diagram_url: diagramUrl,
        });
      }
    }

    if (candidates.length === 0) {
      throw new Error('Zero questions detected in PDF text');
    }

    // Optional Vision Escalation Pass for Low-Confidence Questions (PROMPT 5)
    const provider = getVisionProvider();
    if (provider.isConfigured()) {
      const maxEscalations = 5;
      let escalationsRun = 0;

      for (const candidate of candidates) {
        if (
          candidate.confidence === 'LOW' &&
          escalationsRun < maxEscalations &&
          candidate.sourcePages &&
          candidate.sourcePages.length > 0
        ) {
          const targetPage = candidate.sourcePages[0];
          try {
            const pageImg = await renderPageToImage(buffer, targetPage);
            const visionResult = await provider.reconstructQuestion({
              pageImageBase64: `data:${pageImg.mimeType};base64,${pageImg.base64}`,
              deterministicTextHint: candidate.question_text,
            });

            if (visionResult && visionResult.options.length >= 2) {
              const previousDeterministicAnswer = candidate.correct_answer;
              candidate.question_text = visionResult.questionText || candidate.question_text;
              candidate.options = visionResult.options.map((o) => ({ text: o.text }));

              let visionResolvedAnswer = '';
              if (visionResult.detectedAnswerLetter) {
                const optIndex = visionResult.detectedAnswerLetter.charCodeAt(0) - 65;
                if (visionResult.options[optIndex]) {
                  visionResolvedAnswer = visionResult.options[optIndex].text;
                  candidate.correct_answer = visionResolvedAnswer;
                }
              }

              // Re-score confidence after vision reconstruction
              const reConfidence = scoreConfidence({
                optionCount: candidate.options.length,
                hasProperOptionTexts: candidate.options.every((o) => o.text.trim().length > 0),
                hasStemText: candidate.question_text.length >= 5,
                hasAnswer: Boolean(candidate.correct_answer),
                hasAnswerKeyMatch: Boolean(candidate.correct_answer),
                hasUnresolvedMarkersInStem: false,
              });

              candidate.confidence = reConfidence;
              candidate.needsReview = reConfidence !== 'HIGH';
              candidate.extractionMethod = 'TEXT_PLUS_VISION';

              // Check if deterministic answer key and vision detected answer letter disagree
              const detLetter = previousDeterministicAnswer.length === 1 ? previousDeterministicAnswer : null;
              const visionLetter = visionResult.detectedAnswerLetter;
              if (
                detLetter &&
                visionLetter &&
                detLetter.toUpperCase() !== visionLetter.toUpperCase()
              ) {
                crossValidateCandidate(candidate, {
                  deterministicAnswer: detLetter,
                  visionAnswer: visionLetter,
                });
              }
            }
          } catch (err: any) {
            console.warn(
              `Vision escalation failed for candidate ${candidate.id}:`,
              err?.message || err
            );
          } finally {
            escalationsRun++;
          }
        }
      }
    }

    // Run cross-validation on all candidates (PROMPT 6)
    for (const candidate of candidates) {
      crossValidateCandidate(candidate);
    }

    return candidates;
  }

  // Structure raw text into candidate questions using enhanced regex heuristics (backward compatibility)
  parseCandidatesFromText(rawText: string, _originalFilename?: string): CandidateQuestion[] {
    const trimmed = (rawText || '').trim();
    if (!trimmed) {
      throw new Error('PDF contains no extractable text (e.g. scanned image or empty document)');
    }

    // 1. Detect section boundary and exclude solutions section
    const { questionsText, solutionsText } = detectSectionBoundary(trimmed);
    if (!questionsText) {
      throw new Error('PDF contains no extractable questions section');
    }

    const answerKeyMap = parseAnswerKeyMap(solutionsText || '');

    // 2. Split questions section into blocks
    const delimiterPattern = /(?:^|\n+)(?=(?:(?:Question|Q\.?)\s*\d+[:.]?|\d+[.)]\s+))/i;
    let blocks = questionsText.split(delimiterPattern).map((b) => b.trim()).filter((b) => b.length > 0);

    // If no numbered questions detected, fallback to double-newline blocks
    if (blocks.length <= 1) {
      blocks = questionsText.split(/\n{2,}/).map((b) => b.trim()).filter((b) => b.length > 10);
    }

    const candidates: CandidateQuestion[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      // Separate header line / metadata from stem
      const { questionNumber, examName, examYear, stemText } = splitHeaderAndStem(block);

      // Parse options from stemText
      const optionsWithLetter = parseOptions(stemText);

      // Skip preamble / section header blocks that have no question number, no options, and are purely section headers
      if (
        questionNumber === null &&
        optionsWithLetter.length === 0 &&
        (stemText.length < 20 || /^(?:Questions|Section\s+[A-Z0-9]|Part\s+[A-Z0-9]|General\s+Instructions)/i.test(stemText.trim()))
      ) {
        continue;
      }

      // Extract actual stem (everything before first option)
      let actualStem = stemText;
      if (optionsWithLetter.length > 0 && optionsWithLetter[0].startIndex !== undefined) {
        actualStem = stemText.slice(0, optionsWithLetter[0].startIndex).trim();
      } else if (optionsWithLetter.length > 0) {
        const firstOptLabel = optionsWithLetter[0].label;
        const isNum = /^\d+$/.test(firstOptLabel);
        const firstOptPattern = isNum
          ? new RegExp(`(?:^|[\\n\\r\\t]|\\s{2,}|\\s(?=\\(${firstOptLabel}\\)|${firstOptLabel}[\\.\\)][ \\t]))(?:\\(${firstOptLabel}\\)|${firstOptLabel}[\\.\\)])[ \\t]*`)
          : /(?:^|[\n\r\t]|\s{2,}|\s(?=\([1-5A-Ea-e]\)|[A-Ea-e][.)][ \t]))(?:\(([1-5]|[A-Ea-e])\)|([A-Ea-e])[.)])[ \t]*/;
        const firstOptIndex = stemText.search(firstOptPattern);
        if (firstOptIndex !== -1) {
          actualStem = stemText.slice(0, firstOptIndex).trim();
        }
      }
      actualStem = cleanWatermarks(actualStem);

      // Detect answer key if inline in question block (e.g. Answer: B, Ans: (C), Key: (4))
      let detectedAnsLetter = '';
      const ansMatch = block.match(/(?:Answer|Ans|Correct\s*Answer|Key)\s*[:\-]?\s*\(?([1-5A-Ea-e])\)?/i);
      if (ansMatch) {
        const rawAns = ansMatch[1].toUpperCase();
        const numVal = parseInt(rawAns, 10);
        detectedAnsLetter = !isNaN(numVal) ? String.fromCharCode(64 + numVal) : rawAns;
      } else if (questionNumber && answerKeyMap.has(questionNumber)) {
        detectedAnsLetter = answerKeyMap.get(questionNumber)!;
      }

      // Detect explanation if present in block
      let explanation: string | null = null;
      const expMatch = block.match(
        /(?:Explanation|Solution|Exp)\s*[:\-]?\s*([\s\S]+?)(?=\n\s*(?:(?:Question|Q\.?)\s*\d+|\d+[.)])|$)/i
      );
      if (expMatch) {
        explanation = cleanWatermarks(expMatch[1].trim());
      }

      // Match correct answer to option text if possible
      let resolvedCorrectAnswer = '';
      if (detectedAnsLetter) {
        const matched = optionsWithLetter.find((o) => o.letter === detectedAnsLetter);
        if (matched) {
          resolvedCorrectAnswer = matched.text;
        } else {
          resolvedCorrectAnswer = detectedAnsLetter;
        }
      }

      // Determine quality flags and confidence
      const hasAnswer = Boolean(detectedAnsLetter || resolvedCorrectAnswer);
      const hasText = actualStem.length >= 5;
      const hasAnswerKeyMatch = Boolean(
        detectedAnsLetter && optionsWithLetter.some((o) => o.letter === detectedAnsLetter)
      );
      const hasProperOptionTexts =
        optionsWithLetter.length >= 2 &&
        optionsWithLetter.every((o) => o.text.trim().length > 0 && !o.text.startsWith('('));

      const confidence = scoreConfidence({
        optionCount: optionsWithLetter.length,
        hasProperOptionTexts,
        hasStemText: hasText,
        hasAnswer,
        hasAnswerKeyMatch,
        hasUnresolvedMarkersInStem: /\([1-5A-Ea-e]\)/.test(actualStem),
      });

      const needsReview = confidence !== 'HIGH';
      const isPYQ = Boolean(examName || examYear);

      candidates.push({
        id: `cand-${crypto.randomUUID()}`,
        question_text: actualStem || block.slice(0, 100),
        options: optionsWithLetter.map((o) => ({ text: o.text })),
        correct_answer: resolvedCorrectAnswer,
        explanation: explanation || null,
        question_type: isPYQ ? 'PYQ' : 'CONCEPT',
        difficulty: null,
        status: needsReview ? 'DRAFT' : 'ACTIVE',
        exam_name: examName,
        exam_year: examYear,
        needsReview,
        confidence,
        extractionMethod: 'TEXT',
      });
    }

    if (candidates.length === 0) {
      throw new Error('Zero questions detected in PDF text');
    }

    // Run cross-validation on all candidates (PROMPT 6)
    for (const candidate of candidates) {
      crossValidateCandidate(candidate);
    }

    return candidates;
  }
}

export const extractionService = new ExtractionService();
