import { z } from 'zod';

export const geminiBoundingBoxSchema = z.object({
  x: z.number().min(0).max(1).describe('Normalized X (0-1 fraction of page width) of top-left corner'),
  y: z.number().min(0).max(1).describe('Normalized Y (0-1 fraction of page height) of top-left corner'),
  width: z.number().min(0).max(1).describe('Normalized width (0-1 fraction of page width)'),
  height: z.number().min(0).max(1).describe('Normalized height (0-1 fraction of page height)'),
});

export const geminiOptionSchema = z.object({
  label: z.string().describe("Option label, e.g. '1', '2', '3', '4' or 'A', 'B', 'C', 'D'"),
  text: z.string().describe('Full text and/or formula of the option'),
});

export const geminiVisualElementSchema = z.object({
  type: z.enum(['DIAGRAM', 'GRAPH', 'CHEMICAL_STRUCTURE', 'TABLE', 'FIGURE', 'OTHER']).default('OTHER'),
  description: z.string().optional(),
  pageNumber: z.number().optional(),
  boundingBox: geminiBoundingBoxSchema.optional(),
});

export const geminiExtractedQuestionSchema = z.object({
  questionNumber: z.number().describe('Original 1-based question number from the document'),
  questionText: z.string().describe('Full question stem text, preserving equations, chemistry, math, match-lists'),
  questionType: z
    .enum(['CONCEPT', 'PYQ', 'MCQ', 'MULTI_CORRECT', 'NUMERICAL', 'MATCH_LIST'])
    .default('CONCEPT'),
  options: z.array(geminiOptionSchema).default([]),
  examName: z.string().nullable().optional(),
  examYear: z.number().nullable().optional(),
  sourcePages: z.array(z.number()).default([]),
  hasVisual: z.boolean().default(false),
  visualElements: z.array(geminiVisualElementSchema).default([]),
  explanation: z.string().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});

export const geminiAnswerKeyEntrySchema = z.object({
  questionNumber: z.number().describe('Question number matching the question in the questions array'),
  answer: z.string().describe("Answer identifier (e.g. '1', '2', '3', '4', 'A', 'B', 'C', 'D' or exact option text)"),
});

export const geminiExtractionResponseSchema = z.object({
  document: z
    .object({
      title: z.string().optional(),
      pageCount: z.number().optional(),
    })
    .optional(),
  questions: z.array(geminiExtractedQuestionSchema).default([]),
  answerKey: z.array(geminiAnswerKeyEntrySchema).default([]),
});

export type GeminiBoundingBox = z.infer<typeof geminiBoundingBoxSchema>;
export type GeminiOption = z.infer<typeof geminiOptionSchema>;
export type GeminiVisualElement = z.infer<typeof geminiVisualElementSchema>;
export type GeminiExtractedQuestion = z.infer<typeof geminiExtractedQuestionSchema>;
export type GeminiAnswerKeyEntry = z.infer<typeof geminiAnswerKeyEntrySchema>;
export type GeminiExtractionResponse = z.infer<typeof geminiExtractionResponseSchema>;

/**
 * JSON Schema specification matching geminiExtractionResponseSchema for native
 * structured output enforcement in Google Gemini SDK (@google/genai).
 */
export const geminiResponseJsonSchema = {
  type: 'object',
  properties: {
    document: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        pageCount: { type: 'integer' },
      },
    },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionNumber: { type: 'integer' },
          questionText: { type: 'string' },
          questionType: {
            type: 'string',
            enum: ['CONCEPT', 'PYQ', 'MCQ', 'MULTI_CORRECT', 'NUMERICAL', 'MATCH_LIST'],
          },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                text: { type: 'string' },
              },
              required: ['label', 'text'],
            },
          },
          examName: { type: 'string', nullable: true },
          examYear: { type: 'integer', nullable: true },
          sourcePages: {
            type: 'array',
            items: { type: 'integer' },
          },
          hasVisual: { type: 'boolean' },
          visualElements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['DIAGRAM', 'GRAPH', 'CHEMICAL_STRUCTURE', 'TABLE', 'FIGURE', 'OTHER'],
                },
                description: { type: 'string' },
                pageNumber: { type: 'integer' },
                boundingBox: {
                  type: 'object',
                  properties: {
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                  required: ['x', 'y', 'width', 'height'],
                },
              },
            },
          },
          explanation: { type: 'string', nullable: true },
          warnings: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['questionNumber', 'questionText', 'options', 'hasVisual'],
      },
    },
    answerKey: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          questionNumber: { type: 'integer' },
          answer: { type: 'string' },
        },
        required: ['questionNumber', 'answer'],
      },
    },
  },
  required: ['questions', 'answerKey'],
};

