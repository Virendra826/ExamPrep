import { z } from "zod";

export const subjectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Subject name must be at least 2 characters long")
    .max(100, "Subject name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
});

export const chapterFormSchema = z.object({
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
    .or(z.literal("")),
});

export type SubjectFormData = z.infer<typeof subjectFormSchema>;
export type ChapterFormData = z.infer<typeof chapterFormSchema>;
