import crypto from 'crypto';
import { geminiClientFactory } from './gemini.client.js';
import {
  GEMINI_EXTRACTION_SYSTEM_INSTRUCTION,
  GEMINI_EXTRACTION_USER_PROMPT,
} from './gemini.prompt.js';
import {
  geminiExtractionResponseSchema,
  geminiResponseJsonSchema,
  GeminiExtractionResponse,
} from './gemini.schema.js';
import { normalizeGeminiResponse, NormalizationResult } from './geminiNormalizer.js';
import { CandidateQuestion } from '../ingestion.types.js';
import { renderPageToImage } from '../pageRenderer.js';
import { cropImageBuffer } from '../imageCropper.js';
import { storageProvider } from '../../../storage/index.js';

export interface GeminiExtractionResult {
  candidates: CandidateQuestion[];
  warnings: string[];
  hasCriticalErrors: boolean;
  confidenceCounts: {
    high: number;
    medium: number;
    low: number;
  };
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

    // Setup abort timeout and race with generateContent
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error(`Gemini API request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const generateContentPromise = ai.models.generateContent({
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
          responseSchema: geminiResponseJsonSchema as any,
          temperature: 0.1,
        },
      });

      const response = await Promise.race([generateContentPromise, timeoutPromise]);

      const textResponse = response.text || '';
      if (!textResponse.trim()) {
        throw new Error('Gemini returned an empty response for document extraction');
      }

      // Parse JSON from response
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(textResponse);
      } catch {
        try {
          const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? jsonMatch[0] : textResponse;
          rawJson = JSON.parse(jsonStr);
        } catch (parseErr: unknown) {
          const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          throw new Error(`Failed to parse Gemini JSON output: ${msg}`);
        }
      }

      // Schema validation via Zod (secondary trust boundary defense)
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

      // Visual Asset Capture: rasterize, crop, and store visual diagrams for candidates with visuals
      for (let i = 0; i < normResult.candidates.length; i++) {
        const cand = normResult.candidates[i];
        const rawQ =
          schemaResult.data.questions.find((q) => q.questionNumber === (i + 1)) ||
          schemaResult.data.questions[i];

        if (
          (rawQ?.hasVisual || (rawQ?.visualElements && rawQ.visualElements.length > 0)) &&
          !cand.diagram_url
        ) {
          try {
            const visualEl = rawQ.visualElements?.[0];
            const pageNum = visualEl?.pageNumber || rawQ.sourcePages?.[0] || 1;
            const rendered = await renderPageToImage(pdfBuffer, pageNum);
            if (rendered && rendered.base64) {
              const fullImgBuffer = Buffer.from(rendered.base64, 'base64');
              const croppedBuffer = await cropImageBuffer(fullImgBuffer, visualEl?.boundingBox);
              const ext = rendered.mimeType === 'image/jpeg' ? 'jpg' : 'png';
              const saved = await storageProvider.saveFile(
                croppedBuffer,
                `diagram-${crypto.randomUUID()}.${ext}`,
                rendered.mimeType || 'image/png'
              );
              cand.diagram_url = `/uploads/${saved.storageKey}`;
            }
          } catch (visErr: unknown) {
            console.warn(
              `[GeminiExtraction] Visual asset capture failed for question Q${rawQ?.questionNumber}:`,
              visErr
            );
          }
        }
      }

      const confidenceCounts = {
        high: normResult.candidates.filter((c) => c.confidence === 'HIGH').length,
        medium: normResult.candidates.filter((c) => c.confidence === 'MEDIUM').length,
        low: normResult.candidates.filter((c) => c.confidence === 'LOW').length,
      };

      const processingDurationMs = Date.now() - startTime;

      return {
        candidates: normResult.candidates,
        warnings: normResult.warnings,
        hasCriticalErrors: normResult.hasCriticalErrors,
        confidenceCounts,
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

