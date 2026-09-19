import crypto from 'crypto';
import {
  GeminiExtractionResponse,
  GeminiExtractedQuestion,
} from './gemini.schema.js';
import { CandidateQuestion, CandidateOption } from '../ingestion.types.js';
import { scoreConfidence } from '../confidence.js';
import { cleanWatermarks } from '../extraction.service.js';

export interface NormalizationResult {
  candidates: CandidateQuestion[];
  warnings: string[];
  hasCriticalErrors: boolean;
}

/**
 * Sanitizes question stem text to guarantee that raw base64 image data or data URLs
 * NEVER leak into textual content, while preserving extracted diagram URLs.
 */
export function sanitizeStemAndExtractDiagram(rawStem: string): {
  cleanStem: string;
  extractedDiagramUrl: string | null;
} {
  if (!rawStem) return { cleanStem: '', extractedDiagramUrl: null };

  let extractedDiagramUrl: string | null = null;

  // Extract base64 image data URL if present
  const dataUrlMatch = rawStem.match(/data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+/i);
  if (dataUrlMatch) {
    extractedDiagramUrl = dataUrlMatch[0];
  }

  // Strip all markdown image syntax with data URLs and raw data URLs
  let cleanStem = rawStem
    .replace(/!\[.*?\]\(data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+\)/gi, '')
    .replace(/\(data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+\)/gi, '')
    .replace(/data:image\/[a-zA-Z0-9\+\-\.]+;base64,[A-Za-z0-9+/=]+/gi, '')
    .trim();

  // Normalize excessive newlines
  cleanStem = cleanStem.replace(/\n{3,}/g, '\n\n');

  return { cleanStem, extractedDiagramUrl };
}

export interface OptionSeparationResult {
  cleanStem: string;
  options: CandidateOption[];
  wasRecovered: boolean;
}

/**
 * Robust option parser and stem separator:
 * 1. If options were already provided, cleans any duplicate trailing option block from questionText.
 * 2. If options are missing or fewer than 2, safely detects and recovers options from questionText.
 * 3. Never splits on stem context like "(1) to (4)" or "(1) and (2)".
 */
export function separateStemAndOptions(
  rawStemText: string,
  existingRawOptions: Array<{ label?: string; text?: string }>
): OptionSeparationResult {
  const cleanInputStem = cleanWatermarks(rawStemText.trim());

  // 1. If valid existing options are provided (>= 2 non-empty options)
  const validExisting = existingRawOptions
    .map((o) => {
      let t = (o.text || '').trim();
      // Clean leading option markers (e.g. "(1) ", "1. ", "(A) ", "A) ")
      t = t.replace(/^(?:\([1-5A-Ea-e]\)\s*|[A-Ea-e][\.\)]\s+|[1-5]\)\s+|[1-5]\.\s+)/i, '').trim();
      t = cleanWatermarks(t);
      return { text: t };
    })
    .filter((o) => o.text.length > 0);

  // Match all potential option marker candidates: (1)..(5), (A)..(E), (a)..(e), 1...5., A...E.
  const markerRegex = /(?:\(([1-5]|[A-Ea-e])\)|(?:^|[\n\r\t\s]+)([1-5]|[A-Ea-e])[\.\)][ \t]*)/g;
  const rawMatches: Array<{ label: string; startIndex: number; matchEndIndex: number; isNum: boolean }> = [];
  let m: RegExpExecArray | null;

  while ((m = markerRegex.exec(cleanInputStem)) !== null) {
    const rawLabel = (m[1] || m[2] || '').trim();
    if (!rawLabel) continue;
    const isNum = /^\d+$/.test(rawLabel);
    const label = rawLabel.toUpperCase();
    const leadingWhitespaceMatch = m[0].match(/^[\n\r\t\s]+/);
    const leadingOffset = leadingWhitespaceMatch ? leadingWhitespaceMatch[0].length : 0;
    const startIndex = m.index + leadingOffset;
    const matchEndIndex = m.index + m[0].length;
    rawMatches.push({ label, startIndex, matchEndIndex, isNum });
  }

  // Find valid contiguous increasing sequences (e.g. 1->2->3->4 or A->B->C->D)
  let bestSequence: typeof rawMatches = [];

  for (let i = 0; i < rawMatches.length; i++) {
    const currentSeq = [rawMatches[i]];
    let expectedNextNum = rawMatches[i].isNum ? parseInt(rawMatches[i].label, 10) + 1 : null;
    let expectedNextCharCode = !rawMatches[i].isNum ? rawMatches[i].label.charCodeAt(0) + 1 : null;

    for (let j = i + 1; j < rawMatches.length; j++) {
      const candidate = rawMatches[j];
      if (candidate.isNum && expectedNextNum !== null && parseInt(candidate.label, 10) === expectedNextNum) {
        currentSeq.push(candidate);
        expectedNextNum++;
      } else if (!candidate.isNum && expectedNextCharCode !== null && candidate.label.charCodeAt(0) === expectedNextCharCode) {
        currentSeq.push(candidate);
        expectedNextCharCode++;
      }
    }

    if (currentSeq.length >= 2) {
      if (
        currentSeq.length > bestSequence.length ||
        (currentSeq.length === bestSequence.length && currentSeq[0].startIndex > (bestSequence[0]?.startIndex ?? 0))
      ) {
        bestSequence = currentSeq;
      }
    }
  }

  // If existing options are already present and valid:
  if (validExisting.length >= 2) {
    let cleanStem = cleanInputStem;
    // If the question text also contains a duplicate trailing option block matching bestSequence, strip it
    if (bestSequence.length >= 2 && bestSequence[0].startIndex > 20) {
      const firstMarkerPos = bestSequence[0].startIndex;
      const trailingContent = cleanInputStem.slice(firstMarkerPos);
      // Verify trailing content looks like an option list
      if (bestSequence.length >= 3 || trailingContent.length < cleanInputStem.length * 0.7) {
        cleanStem = cleanInputStem.slice(0, firstMarkerPos).trim();
      }
    }
    return {
      cleanStem,
      options: validExisting,
      wasRecovered: false,
    };
  }

  // If existing options are missing or fewer than 2, recover from text using bestSequence
  if (bestSequence.length >= 2) {
    const firstOptionIndex = bestSequence[0].startIndex;
    const cleanStem = cleanInputStem.slice(0, firstOptionIndex).trim();
    const recoveredOptions: CandidateOption[] = [];

    for (let i = 0; i < bestSequence.length; i++) {
      const current = bestSequence[i];
      const nextStart = i + 1 < bestSequence.length ? bestSequence[i + 1].startIndex : cleanInputStem.length;
      let optText = cleanInputStem.slice(current.matchEndIndex, nextStart).trim();

      // Clean trailing answer or solution tags in last option
      if (i === bestSequence.length - 1) {
        optText = optText.replace(/(?:Answer|Ans|Correct\s*Answer|Key|Explanation|Solution)[\s\S]*$/i, '').trim();
      }

      optText = optText.replace(/^(?:\([1-5A-Ea-e]\)\s*|[A-Ea-e][\.\)]\s+|[1-5]\)\s+|[1-5]\.\s+)/i, '').trim();
      optText = cleanWatermarks(optText);

      recoveredOptions.push({ text: optText });
    }

    if (recoveredOptions.length >= 2) {
      return {
        cleanStem,
        options: recoveredOptions,
        wasRecovered: true,
      };
    }
  }

  // Fallback if no sequence could be parsed
  return {
    cleanStem: cleanInputStem,
    options: validExisting,
    wasRecovered: false,
  };
}

/**
 * Maps and deterministically validates Gemini extraction output into domain CandidateQuestion items.
 */
export function normalizeGeminiResponse(
  rawResponse: GeminiExtractionResponse
): NormalizationResult {
  const warnings: string[] = [];
  const candidates: CandidateQuestion[] = [];

  const rawQuestions = rawResponse.questions || [];
  const answerKeyEntries = rawResponse.answerKey || [];

  if (rawQuestions.length === 0) {
    warnings.push('Gemini returned 0 questions');
    return { candidates: [], warnings, hasCriticalErrors: true };
  }

  // Build answer key lookup map: questionNumber -> answerString
  const answerKeyMap = new Map<number, string>();
  for (const entry of answerKeyEntries) {
    if (typeof entry.questionNumber === 'number' && entry.answer) {
      answerKeyMap.set(entry.questionNumber, entry.answer.trim());
    }
  }

  // Check for duplicate question numbers
  const seenNumbers = new Set<number>();
  for (const q of rawQuestions) {
    if (seenNumbers.has(q.questionNumber)) {
      warnings.push(`Duplicate question number detected in extraction: Q${q.questionNumber}`);
    }
    seenNumbers.add(q.questionNumber);
  }

  // Sort questions by question number
  const sortedQuestions = [...rawQuestions].sort((a, b) => a.questionNumber - b.questionNumber);

  // Check for numbering gaps
  for (let i = 0; i < sortedQuestions.length - 1; i++) {
    const current = sortedQuestions[i].questionNumber;
    const next = sortedQuestions[i + 1].questionNumber;
    if (next > current + 1) {
      warnings.push(`Gap in question numbering detected: missing between Q${current} and Q${next}`);
    }
  }

  for (const q of sortedQuestions) {
    const candidateWarnings: string[] = [...(q.warnings || [])];

    // 1. Sanitize raw stem to eliminate any inline base64 image data
    const { cleanStem: sanitizedStem, extractedDiagramUrl } = sanitizeStemAndExtractDiagram(
      q.questionText || ''
    );

    // 2. Separate stem and options (with safe recovery if options were omitted in structured field)
    const {
      cleanStem,
      options: normalizedOptions,
      wasRecovered,
    } = separateStemAndOptions(sanitizedStem, q.options || []);

    if (wasRecovered) {
      candidateWarnings.push('OPTIONS_RECOVERED_FROM_TEXT');
    }

    // 3. Resolve correct answer from answer key
    const rawAnswerKeyEntry = answerKeyMap.get(q.questionNumber);
    let resolvedCorrectAnswer = '';
    let hasAnswerKeyMatch = false;

    if (rawAnswerKeyEntry) {
      const ansTrimmed = rawAnswerKeyEntry.trim();
      const rawOptions = q.options || [];

      // Case A: Answer is a digit ("1", "2", "3", "4", "5")
      if (/^[1-5]$/.test(ansTrimmed)) {
        const idx = parseInt(ansTrimmed, 10) - 1;
        const matchedByLabel = rawOptions.find((o) => o.label?.trim() === ansTrimmed);
        if (matchedByLabel) {
          const matchIdx = rawOptions.indexOf(matchedByLabel);
          resolvedCorrectAnswer = normalizedOptions[matchIdx]?.text || '';
          hasAnswerKeyMatch = Boolean(resolvedCorrectAnswer);
        } else if (normalizedOptions[idx]) {
          resolvedCorrectAnswer = normalizedOptions[idx].text;
          hasAnswerKeyMatch = true;
        }
      }
      // Case B: Answer is a letter ("A", "B", "C", "D", "E")
      else if (/^[A-Ea-e]$/.test(ansTrimmed)) {
        const letterUpper = ansTrimmed.toUpperCase();
        const idx = letterUpper.charCodeAt(0) - 65;
        const matchedByLabel = rawOptions.find((o) => o.label?.trim().toUpperCase() === letterUpper);
        if (matchedByLabel) {
          const matchIdx = rawOptions.indexOf(matchedByLabel);
          resolvedCorrectAnswer = normalizedOptions[matchIdx]?.text || '';
          hasAnswerKeyMatch = Boolean(resolvedCorrectAnswer);
        } else if (normalizedOptions[idx]) {
          resolvedCorrectAnswer = normalizedOptions[idx].text;
          hasAnswerKeyMatch = true;
        }
      }
      // Case C: Answer is exact option text
      else {
        const matchedOpt = normalizedOptions.find(
          (o) => o.text.trim().toLowerCase() === ansTrimmed.toLowerCase()
        );
        if (matchedOpt) {
          resolvedCorrectAnswer = matchedOpt.text;
          hasAnswerKeyMatch = true;
        } else {
          resolvedCorrectAnswer = ansTrimmed;
          hasAnswerKeyMatch = false;
        }
      }
    }

    if (!resolvedCorrectAnswer) {
      if (normalizedOptions.length > 0) {
        resolvedCorrectAnswer = normalizedOptions[0].text;
        candidateWarnings.push(`No answer key entry found for Q${q.questionNumber}; defaulted to first option`);
      } else {
        candidateWarnings.push(`Missing answer and options for Q${q.questionNumber}`);
      }
    }

    // 4. Validate signals for confidence scoring
    const hasStemText = cleanStem.length >= 5;
    const optionCount = normalizedOptions.length;
    const hasProperOptionTexts =
      optionCount >= 2 &&
      new Set(normalizedOptions.map((o) => o.text.trim())).size === optionCount &&
      normalizedOptions.every((o) => o.text.trim().length > 0 && !o.text.startsWith('('));

    const confidence = scoreConfidence({
      optionCount,
      hasProperOptionTexts,
      hasStemText,
      hasAnswer: Boolean(resolvedCorrectAnswer),
      hasAnswerKeyMatch,
      hasUnresolvedMarkersInStem: /\([1-5A-Ea-e]\)/.test(cleanStem),
    });

    const isPYQ = Boolean(q.examName || q.examYear || q.questionType === 'PYQ');
    const needsReview = confidence !== 'HIGH' || candidateWarnings.length > 0 || wasRecovered;

    let reviewReason: string | null = null;
    if (candidateWarnings.length > 0) {
      reviewReason = candidateWarnings.join('; ');
    } else if (!hasAnswerKeyMatch) {
      reviewReason = 'Answer key entry could not be matched with high confidence';
    } else if (confidence === 'LOW') {
      reviewReason = 'Low confidence extraction (missing stem or options)';
    } else if (confidence === 'MEDIUM') {
      reviewReason = 'Medium confidence extraction (verify options and answer)';
    }

    // Process visual diagrams cleanly (never adding base64 into question text)
    let diagramUrl: string | null = extractedDiagramUrl;
    let finalStem = cleanStem;

    if (q.hasVisual && q.visualElements && q.visualElements.length > 0) {
      const desc = q.visualElements.map((v) => v.description || v.type).filter(Boolean).join(', ');
      if (desc && !finalStem.includes('*Visual Content:')) {
        finalStem = `${finalStem}\n\n*Visual Content: [${desc}]*`;
      }
    }

    candidates.push({
      id: `cand-${crypto.randomUUID()}`,
      question_text: finalStem,
      options: normalizedOptions,
      correct_answer: resolvedCorrectAnswer,
      explanation: q.explanation || null,
      question_type: isPYQ ? 'PYQ' : 'CONCEPT',
      difficulty: null,
      status: needsReview ? 'DRAFT' : 'ACTIVE',
      exam_name: q.examName || null,
      exam_year: q.examYear || null,
      needsReview,
      confidence,
      extractionMethod: 'GEMINI_DOCUMENT' as any,
      sourcePages: q.sourcePages && q.sourcePages.length > 0 ? q.sourcePages : undefined,
      reviewReason,
      diagram_url: diagramUrl,
    });
  }

  const hasCriticalErrors =
    candidates.length === 0 ||
    candidates.filter((c) => c.confidence === 'HIGH').length / candidates.length < 0.2;

  return {
    candidates,
    warnings,
    hasCriticalErrors,
  };
}
