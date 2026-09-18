export interface VisionQuestionOption {
  label: string;
  text: string;
}

export interface VisionQuestionResult {
  questionText: string;
  options: VisionQuestionOption[];
  detectedAnswerLetter: string | null;
  hasVisual: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ReconstructQuestionInput {
  pageImageBase64: string;
  deterministicTextHint: string;
}

export interface QuestionExtractionProvider {
  isConfigured(): boolean;
  reconstructQuestion(input: ReconstructQuestionInput): Promise<VisionQuestionResult>;
}
