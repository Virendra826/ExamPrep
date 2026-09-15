import { Router } from "express";
import { authController } from "./auth.controller.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { createRateLimiter } from "../../middleware/rateLimiter.js";

export const authRouter = Router();

// Rate limiter for sensitive auth endpoints (10 attempts per 15 min per IP)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
  code: "AUTH_RATE_LIMIT_EXCEEDED",
});

authRouter.post("/register", authLimiter, (req, res, next) => authController.register(req, res, next));
authRouter.post("/login", authLimiter, (req, res, next) => authController.login(req, res, next));
authRouter.post("/refresh", (req, res, next) => authController.refresh(req, res, next));
authRouter.post("/logout", (req, res, next) => authController.logout(req, res, next));
authRouter.get("/me", requireAuth, (req, res, next) => authController.me(req, res, next));
