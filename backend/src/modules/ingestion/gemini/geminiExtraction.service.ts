import { geminiClientFactory } from './gemini.client.js';
import {
  GEMINI_EXTRACTION_SYSTEM_INSTRUCTION,
  GEMINI_EXTRACTION_USER_PROMPT,
} from './gemini.prompt.js';
import {
  geminiExtractionResponseSchema,
  GeminiExtractionResponse,
} from './gemini.schema.js';
import { normalizeGeminiResponse, NormalizationResult } from './geminiNormalizer.js';
import { CandidateQuestion } from '../ingestion.types.js';

export interface GeminiExtractionResult {
  candidates: CandidateQuestion[];
  warnings: string[];
  rawResponse?: GeminiExtractionResponse;
  processingDurationMs: number;
}

export class GeminiExtractionService {
  isConfigured(): boolean {
    return geminiClientFactory.isConfigured();
  }

  /**
   * Extract question candidates and answer keys from a PDF buffer using Gemini document understanding.
   */
  async extractQuestionsFromPdf(
    pdfBuffer: Buffer,
    _originalFilename?: string,
    timeoutMs: number = 60000
  ): Promise<GeminiExtractionResult> {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      throw new Error('Gemini API is not configured (GEMINI_API_KEY is not set)');
    }

    const ai = geminiClientFactory.getClient();
    const model = geminiClientFactory.getModelName();

    const base64Pdf = pdfBuffer.toString('base64');

    // Setup abort timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Pdf,
                },
              },
              {
                text: GEMINI_EXTRACTION_USER_PROMPT,
              },
            ],
          },
        ],
        config: {
          systemInstruction: GEMINI_EXTRACTION_SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const textResponse = response.text || '';
      if (!textResponse.trim()) {
        throw new Error('Gemini returned an empty response for document extraction');
      }

      // Parse JSON from response
      let rawJson: unknown;
      try {
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : textResponse;
        rawJson = JSON.parse(jsonStr);
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        throw new Error(`Failed to parse Gemini JSON output: ${msg}`);
      }

      // Schema validation via Zod
      const schemaResult = geminiExtractionResponseSchema.safeParse(rawJson);
      if (!schemaResult.success) {
        const errDetails = schemaResult.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        throw new Error(`Gemini response failed schema validation: ${errDetails}`);
      }

      // Deterministic validation and normalization
      const normResult: NormalizationResult = normalizeGeminiResponse(schemaResult.data);
      if (normResult.candidates.length === 0) {
        throw new Error('Zero valid question candidates could be extracted from Gemini output');
      }

      const processingDurationMs = Date.now() - startTime;

      return {
        candidates: normResult.candidates,
        warnings: normResult.warnings,
        rawResponse: schemaResult.data,
        processingDurationMs,
      };
    } catch (err: unknown) {
      // Sanitize error message to ensure no API key or sensitive data is leaked
      let sanitizedMessage = err instanceof Error ? err.message : 'Unknown Gemini error';
      const apiKey = geminiClientFactory.getApiKey();
      if (apiKey) {
        sanitizedMessage = sanitizedMessage.split(apiKey).join('[REDACTED_API_KEY]');
      }

      throw new Error(`Gemini extraction failed: ${sanitizedMessage}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const geminiExtractionService = new GeminiExtractionService();
