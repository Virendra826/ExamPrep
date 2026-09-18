import { z } from 'zod';

export const visionOptionSchema = z.object({
  label: z.string().default(''),
  text: z.string().min(1, 'Option text cannot be empty'),
});

export const visionQuestionResultSchema = z.object({
  questionText: z.string().min(1, 'Question text cannot be empty'),
  options: z.array(visionOptionSchema).min(2, 'At least 2 options required'),
  detectedAnswerLetter: z.string().nullable().default(null),
  hasVisual: z.boolean().default(false),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).default('HIGH'),
});

export type ValidatedVisionQuestionResult = z.infer<typeof visionQuestionResultSchema>;
