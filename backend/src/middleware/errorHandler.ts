import { type Request, type Response, type NextFunction, type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";
import { env } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // 1. Handled AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Malformed JSON payload in request body.",
      },
    });
    return;
  }

  // 2. Handled Zod validation errors
  if (
    err instanceof ZodError ||
    err.name === "ZodError" ||
    (err as unknown as { issues: unknown[] }).issues !== undefined
  ) {
    const issues = (err as ZodError).issues || [];
    const formattedErrors = issues.map((e) => ({
      field: Array.isArray(e.path) ? e.path.join(".") : String(e.path),
      message: e.message,
    }));

    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: formattedErrors,
      },
    });
    return;
  }

  // 3. Handled Prisma specific errors (e.g. Unique constraint)
  if ("code" in err && typeof err.code === "string") {
    if (err.code === "P2002") {
      res.status(409).json({
        error: {
          code: "CONFLICT",
          message: "A record with this unique field already exists.",
        },
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Requested record not found in database.",
        },
      });
      return;
    }
  }

  // 4. Fallback for unhandled unexpected internal errors
  const isProduction = env.NODE_ENV === "production";
  if (!isProduction && env.NODE_ENV !== "test") {
    console.error("💥 Unhandled Error:", err);
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isProduction ? "An unexpected server error occurred" : err.message || "Internal server error",
    },
  });
};
