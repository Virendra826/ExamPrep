import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { UnauthorizedError } from "../utils/errors.js";
import { AccessTokenPayload } from "../types/auth.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check cookie first, fallback to Authorization header
    let token = req.cookies?.access_token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      throw new UnauthorizedError("UNAUTHORIZED", "Authentication required");
    }

    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("TOKEN_EXPIRED", "Access token has expired");
      }
      throw new UnauthorizedError("INVALID_TOKEN", "Invalid access token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedError("UNAUTHORIZED", "User account is disabled or does not exist");
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
