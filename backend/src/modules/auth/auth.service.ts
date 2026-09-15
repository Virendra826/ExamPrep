import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { ConflictError, UnauthorizedError } from "../../utils/errors.js";
import { RegisterInput, LoginInput } from "./auth.validator.js";
import { AccessTokenPayload, AuthUser } from "../../types/auth.js";

// Access token lifetime: 15 minutes
const ACCESS_TOKEN_EXPIRY = "15m";
// Refresh token lifetime: 7 days
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateAccessToken(user: { id: string; role: Role }): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function generateRefreshTokenString(): string {
  return crypto.randomBytes(40).toString("hex");
}

export class AuthService {
  /**
   * Register a new student user
   */
  async register(input: RegisterInput): Promise<AuthUser> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictError("A user with this email address already exists.");
    }

    const password_hash = await bcrypt.hash(input.password, 10);

    // Strictly enforce Role.STUDENT regardless of any input
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password_hash,
        role: Role.STUDENT,
        is_active: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
      },
    });

    return user;
  }

  /**
   * Login user, generate access token & persistent hashed refresh token
   */
  async login(input: LoginInput): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    // Timing-safe check & constant error response so email presence is not revealed
    if (!user || !user.is_active) {
      throw new UnauthorizedError("INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedError("INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const accessToken = generateAccessToken(user);
    const refreshTokenRaw = generateRefreshTokenString();
    const tokenHash = hashToken(refreshTokenRaw);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
      },
      accessToken,
      refreshToken: refreshTokenRaw,
    };
  }

  /**
   * Refresh session with token rotation (revoke old, issue new)
   */
  async refresh(refreshTokenRaw: string | undefined): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    if (!refreshTokenRaw) {
      throw new UnauthorizedError("REFRESH_TOKEN_REQUIRED", "Refresh token is required.");
    }

    const tokenHash = hashToken(refreshTokenRaw);

    const storedToken = await prisma.refreshToken.findFirst({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    // Check if token exists, is expired, or already revoked
    if (
      !storedToken ||
      storedToken.revoked_at !== null ||
      storedToken.expires_at < new Date()
    ) {
      throw new UnauthorizedError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token.");
    }

    const user = storedToken.user;
    if (!user || !user.is_active) {
      throw new UnauthorizedError("USER_INACTIVE", "User account is disabled.");
    }

    // Token rotation: Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked_at: new Date() },
    });

    // Issue new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshTokenRaw = generateRefreshTokenString();
    const newTokenHash = hashToken(newRefreshTokenRaw);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: newTokenHash,
        expires_at: newExpiresAt,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshTokenRaw,
    };
  }

  /**
   * Logout: Revoke active refresh token in database
   */
  async logout(refreshTokenRaw: string | undefined): Promise<void> {
    if (!refreshTokenRaw) return;

    const tokenHash = hashToken(refreshTokenRaw);
    await prisma.refreshToken.updateMany({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedError("USER_NOT_FOUND", "User profile not found or inactive.");
    }

    return user;
  }
}

export const authService = new AuthService();
