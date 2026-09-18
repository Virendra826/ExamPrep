import { z } from "zod";

export const MAX_QUIZ_QUESTION_COUNT = 100; // Cap at 100 questions per quiz session for performance and sane session length

export const quizConfigSchema = z
  .object({
    subject_id: z.string().min(1, "Subject is required"),
    chapter_id: z.string().nullable().optional(),
    question_type_filter: z.enum(["CONCEPT", "PYQ", "BOTH"]),
    requested_count: z
      .number()
      .int("Question count must be an integer")
      .min(1, "Question count must be at least 1")
      .max(
        MAX_QUIZ_QUESTION_COUNT,
        `Question count cannot exceed ${MAX_QUIZ_QUESTION_COUNT}`
      ),
    order_mode: z.enum(["SEQUENTIAL", "RANDOM"]),
    timer_mode: z.enum(["FIXED", "VARIABLE"]),
    timer_duration_minutes: z.number().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.timer_mode === "FIXED") {
        return (
          typeof data.timer_duration_minutes === "number" &&
          data.timer_duration_minutes > 0
        );
      }
      return true;
    },
    {
      message: "Timer duration in minutes must be greater than 0 for Fixed timer mode",
      path: ["timer_duration_minutes"],
    }
  );

export type QuizConfigFormValues = z.infer<typeof quizConfigSchema>;
