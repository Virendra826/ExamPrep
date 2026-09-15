import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().trim().min(2, "Name must be at least 2 characters long"),
  // Note: 'role' is intentionally excluded to prevent client role spoofing
});

export const loginSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
