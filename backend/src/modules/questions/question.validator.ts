import { z } from 'zod';
import { QuestionType, QuestionStatus } from '@prisma/client';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidFormat = (msg: string) => z.string().regex(uuidRegex, msg);

export const optionSchema = z.object({
  id: z.string().regex(uuidRegex).optional(),
  text: z.string().min(1, 'Option text is required'),
});

export const createQuestionSchema = z.object({
  question_text: z.string().min(1, 'Question text is required'),
  options: z.array(optionSchema).min(2, 'At least two options are required'),
  correct_answer: z.string().min(1, 'Correct answer is required'),
  subject_id: uuidFormat('Invalid subject ID'),
  chapter_id: uuidFormat('Invalid chapter ID'),
  question_type: z.nativeEnum(QuestionType),
  difficulty: z.string().optional(),
  status: z.nativeEnum(QuestionStatus).optional().default(QuestionStatus.DRAFT),
  exam_name: z.string().optional().nullable(),
  exam_year: z.coerce.number().optional().nullable(),
  explanation: z.string().optional().nullable(),
})
  .refine((data) => {
    const match = data.options.some(
      (opt) => opt.id === data.correct_answer || opt.text === data.correct_answer
    );
    return match;
  }, { message: 'Correct answer must match one of the provided options', path: ['correct_answer'] })
  .refine((data) => {
    if (data.question_type === QuestionType.PYQ) {
      return data.exam_name != null && data.exam_year != null;
    }
    return true;
  }, {
    message: 'PYQ questions require exam_name and exam_year',
    path: ['exam_name', 'exam_year'],
  });

export const updateQuestionSchema = z.object({
  question_text: z.string().min(1, 'Question text is required').optional(),
  options: z.array(optionSchema).min(2, 'At least two options are required').optional(),
  correct_answer: z.string().min(1, 'Correct answer is required').optional(),
  subject_id: uuidFormat('Invalid subject ID').optional(),
  chapter_id: uuidFormat('Invalid chapter ID').optional(),
  question_type: z.nativeEnum(QuestionType).optional(),
  difficulty: z.string().optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
  exam_name: z.string().optional().nullable(),
  exam_year: z.coerce.number().optional().nullable(),
  explanation: z.string().optional().nullable(),
})
  .refine((data) => {
    if (data.correct_answer && data.options) {
      const match = data.options.some(
        (opt) => opt.id === data.correct_answer || opt.text === data.correct_answer
      );
      return match;
    }
    return true;
  }, { message: 'Correct answer must match one of the provided options', path: ['correct_answer'] })
  .refine((data) => {
    if (data.question_type === QuestionType.PYQ) {
      if (data.exam_name == null || data.exam_year == null) return false;
    } else {
      if (data.exam_name != null || data.exam_year != null) return false;
    }
    return true;
  }, {
    message: 'PYQ questions require exam_name and exam_year; other types must not provide them',
    path: ['exam_name', 'exam_year'],
  });

export const questionQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  subject_id: uuidFormat('Invalid subject ID').optional(),
  chapter_id: uuidFormat('Invalid chapter ID').optional(),
  question_type: z.nativeEnum(QuestionType).optional(),
  status: z.nativeEnum(QuestionStatus).optional(),
  search: z.string().optional(),
});

export const availableCountQuerySchema = z.object({
  subjectId: uuidFormat('Invalid subject ID'),
  chapterId: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== '' ? val : undefined))
    .refine((val) => val === undefined || uuidRegex.test(val), {
      message: 'Invalid chapter ID',
    }),
  type: z.enum(['CONCEPT', 'PYQ', 'BOTH']).default('BOTH'),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type QuestionQuery = z.infer<typeof questionQuerySchema>;
export type AvailableCountQuery = z.infer<typeof availableCountQuerySchema>;
