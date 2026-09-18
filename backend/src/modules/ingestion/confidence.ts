export interface ConfidenceSignals {
  optionCount: number;
  hasProperOptionTexts: boolean;
  hasStemText: boolean;
  hasAnswer: boolean;
  hasAnswerKeyMatch: boolean;
  hasUnresolvedMarkersInStem?: boolean;
}

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Pure deterministic confidence scoring function:
 * Evaluates options count, answer presence, answer-key match, stem length, and markers.
 * Never throws — always returns 'HIGH' | 'MEDIUM' | 'LOW'.
 */
export function scoreConfidence(signals?: Partial<ConfidenceSignals> | null): ConfidenceTier {
  if (!signals) return 'LOW';

  const {
    optionCount = 0,
    hasProperOptionTexts = false,
    hasStemText = false,
    hasAnswer = false,
    hasAnswerKeyMatch = false,
    hasUnresolvedMarkersInStem = false,
  } = signals;

  // Critical signals missing -> LOW
  if (!hasStemText || optionCount < 2 || !hasProperOptionTexts || !hasAnswer) {
    return 'LOW';
  }

  // All signals optimal: 4 valid options, verified answer match from key, clean stem
  if (optionCount >= 4 && hasAnswerKeyMatch && !hasUnresolvedMarkersInStem) {
    return 'HIGH';
  }

  // Moderate quality: e.g. 2-3 options, or answer fallback to first option, or minor unresolved marker
  return 'MEDIUM';
}
