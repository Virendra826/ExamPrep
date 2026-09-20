import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 characters long"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters long"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  STORAGE_DRIVER: z.enum(["local", "s3", "supabase"]).default("local"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("examprep-assets"),
  VISION_PROVIDER: z.enum(["disabled", "anthropic", "openai"]).default("disabled"),
  VISION_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  EXTRACTION_ENGINE: z.enum(["gemini", "hybrid", "local"]).default("hybrid"),
  HYBRID_RECONCILIATION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.3),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  throw new Error("Invalid environment configuration. Check your .env file.");
}

export const env = parsed.data;
export default env;
