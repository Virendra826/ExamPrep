import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import { Role } from "@prisma/client";
import {
  securityHeaders,
  corsMiddleware,
  requestLogger,
  errorHandler,
  requireAuth,
  requireRole,
} from "./middleware/index.js";
import path from "path";
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { subjectRouter } from "./modules/subjects/subject.routes.js";
import { chapterRouter } from "./modules/chapters/chapter.routes.js";
import { questionRouter } from "./modules/questions/question.routes.js";
import { ingestionRouter } from "./modules/ingestion/ingestion.routes.js";
import { quizRouter } from "./modules/quiz/quiz.routes.js";
import { attemptRouter } from "./modules/attempts/attempt.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { NotFoundError, ValidationError } from "./utils/errors.js";

export const app: Express = express();

// Security headers
app.use(securityHeaders);

// CORS configuration
app.use(corsMiddleware);

// Request logging (no sensitive credentials logged)
app.use(requestLogger);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing (for HTTP-only JWTs and refresh tokens)
app.use(cookieParser());

// Static file uploads serving for local storage provider
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// API Routes
app.use("/", healthRouter);
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/subjects", subjectRouter);
app.use("/api/v1/chapters", chapterRouter);
app.use("/api/v1/questions", questionRouter);
app.use("/api/v1/ingestion", ingestionRouter);
app.use("/api/v1/quiz", quizRouter);
app.use("/api/v1/quizzes", quizRouter);
app.use("/api/v1/attempts", attemptRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/admin", adminRouter);

// Test-only endpoints for verifying error handling and RBAC
if (process.env.NODE_ENV === "test") {
  app.get("/api/v1/test/forced-error", () => {
    throw new ValidationError("Forced validation error for testing.");
  });

  app.get("/api/v1/test/admin-only", requireAuth, requireRole(Role.ADMIN), (_req, res) => {
    res.status(200).json({ status: "admin-access-granted" });
  });
}

// 404 handler for unmatched routes
app.use((_req, _res, next) => {
  next(new NotFoundError("Requested API route does not exist."));
});

// Centralized error handling
app.use(errorHandler);

export default app;
