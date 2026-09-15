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
import { healthRouter } from "./routes/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
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

// API Routes
app.use("/api/v1", healthRouter);
app.use("/api/v1/auth", authRouter);

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
