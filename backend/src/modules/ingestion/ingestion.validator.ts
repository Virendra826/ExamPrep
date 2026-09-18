import { z } from 'zod';
import { QuestionType, QuestionStatus, Difficulty } from '@prisma/client';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidFormat = (msg: string) => z.string().regex(uuidRegex, msg);

export const candidateOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1, 'Option text is required'),
});

export const reviewedQuestionItemSchema = z
  .object({
    id: z.string().optional(),
    question_text: z.string().min(1, 'Question text is required'),
    options: z.array(candidateOptionSchema).min(2, 'At least two options are required'),
    correct_answer: z.string().min(1, 'Correct answer is required'),
    subject_id: uuidFormat('Invalid subject ID'),
    chapter_id: uuidFormat('Invalid chapter ID'),
    question_type: z.nativeEnum(QuestionType),
    difficulty: z.nativeEnum(Difficulty).optional().nullable(),
    status: z.nativeEnum(QuestionStatus).optional().default(QuestionStatus.ACTIVE),
    exam_name: z.string().optional().nullable(),
    exam_year: z.coerce.number().optional().nullable(),
    explanation: z.string().optional().nullable(),
    diagram_url: z.string().optional().nullable(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().nullable(),
    sourcePages: z.array(z.number()).optional().nullable(),
    extractionMethod: z.enum(['TEXT', 'TEXT_PLUS_VISION']).optional().nullable(),
    reviewReason: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      return data.options.some(
        (opt) => opt.id === data.correct_answer || opt.text === data.correct_answer
      );
    },
    { message: 'Correct answer must match one of the provided options', path: ['correct_answer'] }
  )
  .refine(
    (data) => {
      if (data.question_type === QuestionType.PYQ) {
        return data.exam_name != null && data.exam_year != null;
      }
      return true;
    },
    {
      message: 'PYQ questions require exam_name and exam_year',
      path: ['exam_name', 'exam_year'],
    }
  );

export const submitBatchQuestionsSchema = z.object({
  questions: z.array(reviewedQuestionItemSchema).min(1, 'At least one question is required in the review batch'),
});

export const batchIdParamSchema = z.object({
  batchId: uuidFormat('Invalid Ingestion Batch ID'),
});

export type ReviewedQuestionItem = z.infer<typeof reviewedQuestionItemSchema>;
export type SubmitBatchQuestionsInput = z.infer<typeof submitBatchQuestionsSchema>;
