import rateLimit, { type Options } from "express-rate-limit";
import { type Request, type Response } from "express";

export interface RateLimitConfig {
  windowMs?: number;
  max?: number;
  message?: string;
  code?: string;
}

export function createRateLimiter(config: RateLimitConfig = {}) {
  const windowMs = config.windowMs ?? 15 * 60 * 1000; // default 15 minutes
  const max = config.max ?? 100; // default 100 requests per window
  const code = config.code ?? "RATE_LIMIT_EXCEEDED";
  const message = config.message ?? "Too many requests. Please try again later.";

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code,
          message,
        },
      });
    },
    // Don't rate-limit test environments
    skip: () => process.env.NODE_ENV === "test",
  } as Partial<Options>);
}
