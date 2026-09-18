import {
  QuestionExtractionProvider,
  ReconstructQuestionInput,
  VisionQuestionResult,
} from './questionExtractionProvider.js';

export class DisabledProvider implements QuestionExtractionProvider {
  isConfigured(): boolean {
    return false;
  }

  async reconstructQuestion(_input: ReconstructQuestionInput): Promise<VisionQuestionResult> {
    throw new Error(
      'Vision provider is not configured. Check VISION_PROVIDER and VISION_API_KEY environment variables before calling reconstructQuestion.'
    );
  }
}
