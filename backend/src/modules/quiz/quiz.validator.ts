import { z } from 'zod';
import { QuestionTypeFilter, OrderMode, TimerMode } from '@prisma/client';

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidFormat = (msg: string) => z.string().regex(uuidRegex, msg);

export const createQuizSchema = z
  .object({
    subject_id: uuidFormat('Invalid subject ID'),
    chapter_id: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== '' ? val : null))
      .refine((val) => val === null || val === undefined || uuidRegex.test(val), {
        message: 'Invalid chapter ID',
      }),
    question_type_filter: z.nativeEnum(QuestionTypeFilter).default(QuestionTypeFilter.BOTH),
    requested_count: z.coerce.number().int().min(1, 'At least 1 question is required').max(100, 'Requested question count cannot exceed 100'),
    order_mode: z.nativeEnum(OrderMode).default(OrderMode.RANDOM),
    timer_mode: z.nativeEnum(TimerMode).default(TimerMode.VARIABLE),
    timer_duration_seconds: z.coerce.number().int().positive('Timer duration must be positive').optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.timer_mode === TimerMode.FIXED) {
        return data.timer_duration_seconds != null && data.timer_duration_seconds > 0;
      }
      return true;
    },
    {
      message: 'Fixed timer mode requires timer_duration_seconds to be a positive integer',
      path: ['timer_duration_seconds'],
    }
  );

export const quizIdParamSchema = z.object({
  quizId: uuidFormat('Invalid quiz ID'),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
