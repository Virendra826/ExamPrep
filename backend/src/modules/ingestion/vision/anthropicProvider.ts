import { env } from '../../../config/env.js';
import {
  QuestionExtractionProvider,
  ReconstructQuestionInput,
  VisionQuestionResult,
} from './questionExtractionProvider.js';
import { visionQuestionResultSchema } from './visionResultSchema.js';

export class AnthropicProvider implements QuestionExtractionProvider {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || env.VISION_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async reconstructQuestion(input: ReconstructQuestionInput): Promise<VisionQuestionResult> {
    if (!this.isConfigured()) {
      throw new Error('Anthropic provider is not configured with an API key');
    }

    const base64Data = input.pageImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const prompt = `You are an expert exam question extractor. Analyze this exam page and reconstruct the single specific question described in the text hint.

Text hint from deterministic extraction:
"${input.deterministicTextHint}"

Return ONLY a valid JSON object with the following exact schema:
{
  "questionText": "Full stem of the question (use LaTeX for math if appropriate)",
  "options": [
    { "label": "1", "text": "Option 1 text" },
    { "label": "2", "text": "Option 2 text" },
    { "label": "3", "text": "Option 3 text" },
    { "label": "4", "text": "Option 4 text" }
  ],
  "detectedAnswerLetter": "A",
  "hasVisual": true,
  "confidence": "HIGH"
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API returned error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      const contentText = data?.content?.[0]?.text || '';
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Anthropic response did not contain JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return visionQuestionResultSchema.parse(parsed);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
