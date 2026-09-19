import { z } from 'zod';

export const geminiOptionSchema = z.object({
  label: z.string().describe("Option label, e.g. '1', '2', '3', '4' or 'A', 'B', 'C', 'D'"),
  text: z.string().describe("Full text and/or formula of the option"),
});

export const geminiVisualElementSchema = z.object({
  type: z.enum(['DIAGRAM', 'GRAPH', 'CHEMICAL_STRUCTURE', 'TABLE', 'FIGURE', 'OTHER']).default('OTHER'),
  description: z.string().optional(),
  pageNumber: z.number().optional(),
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

export type GeminiOption = z.infer<typeof geminiOptionSchema>;
export type GeminiVisualElement = z.infer<typeof geminiVisualElementSchema>;
export type GeminiExtractedQuestion = z.infer<typeof geminiExtractedQuestionSchema>;
export type GeminiAnswerKeyEntry = z.infer<typeof geminiAnswerKeyEntrySchema>;
export type GeminiExtractionResponse = z.infer<typeof geminiExtractionResponseSchema>;
