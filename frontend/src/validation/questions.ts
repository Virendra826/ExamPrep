import { z } from "zod";

export const optionSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1, "Option text is required"),
});

export const questionFormSchema = z
  .object({
    question_text: z
      .string()
      .trim()
      .min(1, "Question text is required"),
    options: z
      .array(optionSchema)
      .min(2, "At least two options are required"),
    correct_answer: z
      .string()
      .trim()
      .min(1, "Correct answer is required"),
    subject_id: z
      .string()
      .min(1, "Please select a subject"),
    chapter_id: z
      .string()
      .min(1, "Please select a chapter"),
    question_type: z.enum(["CONCEPT", "PYQ"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional().nullable(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]).default("DRAFT"),
    exam_name: z.string().optional().nullable(),
    exam_year: z
      .union([
        z.number().int().min(1950, "Exam year must be valid").max(2100),
        z
          .string()
          .trim()
          .regex(/^\d{4}$/, "Exam year must be a 4-digit year")
          .transform((val) => parseInt(val, 10)),
      ])
      .optional()
      .nullable(),
    explanation: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      return data.options.some(
        (opt) =>
          (opt.id && opt.id === data.correct_answer) ||
          opt.text.trim() === data.correct_answer.trim()
      );
    },
    {
      message: "Correct answer must match one of the provided options",
      path: ["correct_answer"],
    }
  )
  .refine(
    (data) => {
      if (data.question_type === "PYQ") {
        return (
          typeof data.exam_name === "string" &&
          data.exam_name.trim().length > 0 &&
          data.exam_year != null &&
          !Number.isNaN(data.exam_year)
        );
      }
      return true;
    },
    {
      message: "PYQ questions require both Exam Name and Exam Year",
      path: ["exam_name"],
    }
  );

export type QuestionFormData = z.infer<typeof questionFormSchema>;
