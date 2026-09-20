import { type Request, type Response, type NextFunction } from "express";
import { authService } from "./auth.service.js";
import { registerSchema, loginSchema } from "./auth.validator.js";
import { env } from "../../config/env.js";

const COOKIE_ACCESS_NAME = "access_token";
const COOKIE_REFRESH_NAME = "refresh_token";

const isProduction = env.NODE_ENV === "production";

// Cookie options
const accessCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 15 * 60 * 1000, // 15 minutes
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? ("none" as const) : ("lax" as const),
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = registerSchema.parse(req.body);
      const user = await authService.register(validated);

      res.status(201).json({
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);
      const { user, accessToken, refreshToken } = await authService.login(validated);

      // Set HTTP-only cookies
      res.cookie(COOKIE_ACCESS_NAME, accessToken, accessCookieOptions);
      res.cookie(COOKIE_REFRESH_NAME, refreshToken, refreshCookieOptions);

      // Never return tokens in the response body
      res.status(200).json({
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[COOKIE_REFRESH_NAME];
      const { user, accessToken, refreshToken } = await authService.refresh(rawRefreshToken);

      res.cookie(COOKIE_ACCESS_NAME, accessToken, accessCookieOptions);
      res.cookie(COOKIE_REFRESH_NAME, refreshToken, refreshCookieOptions);

      res.status(200).json({
        user,
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[COOKIE_REFRESH_NAME];
      await authService.logout(rawRefreshToken);

      res.clearCookie(COOKIE_ACCESS_NAME, { ...accessCookieOptions, maxAge: 0 });
      res.clearCookie(COOKIE_REFRESH_NAME, { ...refreshCookieOptions, maxAge: 0 });

      res.status(200).json({
        message: "Logged out successfully",
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        user: req.user,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
