import { z } from "zod";

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidFormat = (msg: string) => z.string().regex(uuidRegex, msg);

export const createChapterSchema = z.object({
  subject_id: uuidFormat("Valid subject ID is required"),
  name: z
    .string()
    .trim()
    .min(2, "Chapter name must be at least 2 characters long")
    .max(100, "Chapter name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .nullable(),
});

export const updateChapterSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Chapter name must be at least 2 characters long")
      .max(100, "Chapter name cannot exceed 100 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .optional()
      .nullable(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: "At least one field (name or description) must be provided for update",
  });

export const chapterIdParamSchema = z.object({
  id: uuidFormat("Invalid chapter ID format"),
});

export const subjectIdParamSchema = z.object({
  subjectId: uuidFormat("Invalid subject ID format"),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
