import { z } from 'zod';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidFormat = (msg: string) => z.string().regex(uuidRegex, msg);

export const attemptIdParamSchema = z.object({
  attemptId: uuidFormat('Invalid attempt ID'),
});

export const saveAnswerParamSchema = z.object({
  attemptId: uuidFormat('Invalid attempt ID'),
  quizQuestionId: uuidFormat('Invalid quiz question ID'),
});

export const saveAnswerBodySchema = z.object({
  selected_option: z.string().nullable().optional(),
});

export const attemptHistoryQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

export type SaveAnswerInput = z.infer<typeof saveAnswerBodySchema>;
