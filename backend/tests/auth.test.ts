import request from "supertest";
import { describe, it, expect, afterAll } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { Role } from "@prisma/client";

describe("Auth Module & RBAC Middleware", () => {
  const testStudentEmail = `test.student.${Date.now()}@examprep.dev`;
  const testStudentPassword = "TestPassword123!";
  const testStudentName = "Test Student";

  afterAll(async () => {
    // Clean up created test user and associated tokens
    await prisma.refreshToken.deleteMany({
      where: { user: { email: { contains: "test.student." } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: "test.student." } },
    });
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // Registration Tests
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/auth/register", () => {
    it("should successfully register a new student user", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: testStudentEmail,
        password: testStudentPassword,
        name: testStudentName,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe(testStudentEmail.toLowerCase());
      expect(res.body.user.name).toBe(testStudentName);
      expect(res.body.user.role).toBe(Role.STUDENT);
      expect(res.body.user.is_active).toBe(true);
      expect(res.body.user).not.toHaveProperty("password_hash");
    });

    it("should reject duplicate email with 409 Conflict", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: testStudentEmail,
        password: testStudentPassword,
        name: "Duplicate User",
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty("code", "CONFLICT");
    });

    it("should reject invalid password with 400 Validation Error", async () => {
      const res = await request(app).post("/api/v1/auth/register").send({
        email: "shortpw@examprep.dev",
        password: "short", // less than 8 chars, missing uppercase/number
        name: "Short User",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty("code", "VALIDATION_ERROR");
      expect(res.body.error).toHaveProperty("details");
    });

    it("should prevent client role spoofing and always create a STUDENT", async () => {
      const clientEmail = `tamper.${Date.now()}@examprep.dev`;
      const res = await request(app).post("/api/v1/auth/register").send({
        email: clientEmail,
        password: "SecurePass123!",
        name: "Tamper User",
        role: "ADMIN", // Client trying to become admin
      });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe(Role.STUDENT);

      // Clean up
      await prisma.user.delete({ where: { email: clientEmail } });
    });
  });

  // ---------------------------------------------------------------------------
  // Login Tests
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/auth/login", () => {
    it("should login successfully and set HTTP-only cookies without tokens in JSON body", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: testStudentEmail,
        password: testStudentPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testStudentEmail.toLowerCase());
      expect(res.body).not.toHaveProperty("accessToken");
      expect(res.body).not.toHaveProperty("refreshToken");

      const cookies = res.headers["set-cookie"] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.startsWith("access_token="))).toBe(true);
      expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
      expect(cookies.some((c) => c.includes("HttpOnly"))).toBe(true);
    });

    it("should reject invalid password with 401 and generic error message", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: testStudentEmail,
        password: "WrongPassword999!",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password.");
    });

    it("should reject non-existent user with identical 401 and generic error message", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "nonexistent@examprep.dev",
        password: "WrongPassword999!",
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password.");
    });
  });

  // ---------------------------------------------------------------------------
  // /auth/me Tests
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/auth/me", () => {
    it("should return 401 Unauthorized when no cookie is present", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return current user when valid access_token cookie is provided", async () => {
      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: testStudentEmail,
        password: testStudentPassword,
      });

      const cookies = loginRes.headers["set-cookie"];

      const meRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Cookie", cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe(testStudentEmail.toLowerCase());
      expect(meRes.body.user.role).toBe(Role.STUDENT);
    });
  });

  // ---------------------------------------------------------------------------
  // Token Refresh & Rotation Tests
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/auth/refresh", () => {
    it("should rotate refresh token and reject reuse of old refresh token", async () => {
      // 1. Login to obtain initial cookies
      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: testStudentEmail,
        password: testStudentPassword,
      });
      const initialCookies = loginRes.headers["set-cookie"] as unknown as string[];
      const refreshCookie = initialCookies.find((c) => c.startsWith("refresh_token="));
      expect(refreshCookie).toBeDefined();

      // 2. Perform refresh using the refresh cookie
      const refreshRes1 = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [refreshCookie!]);

      expect(refreshRes1.status).toBe(200);
      const newCookies = refreshRes1.headers["set-cookie"] as unknown as string[];
      expect(newCookies.some((c) => c.startsWith("access_token="))).toBe(true);
      expect(newCookies.some((c) => c.startsWith("refresh_token="))).toBe(true);

      // 3. Attempting to reuse the old refresh token MUST fail with 401
      const reuseRes = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [refreshCookie!]);

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });
  });

  // ---------------------------------------------------------------------------
  // Logout Tests
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/auth/logout", () => {
    it("should revoke token and clear cookies so subsequent refresh fails", async () => {
      // 1. Login
      const loginRes = await request(app).post("/api/v1/auth/login").send({
        email: testStudentEmail,
        password: testStudentPassword,
      });
      const cookies = loginRes.headers["set-cookie"] as unknown as string[];
      const refreshCookie = cookies.find((c) => c.startsWith("refresh_token="));

      // 2. Logout
      const logoutRes = await request(app)
        .post("/api/v1/auth/logout")
        .set("Cookie", [refreshCookie!]);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe("Logged out successfully");

      // Check cookies cleared (max-age 0 or expired)
      const logoutCookies = logoutRes.headers["set-cookie"] as unknown as string[];
      expect(logoutCookies.some((c) => c.includes("Max-Age=0") || c.includes("expires="))).toBe(true);

      // 3. Subsequent refresh with the revoked token must fail
      const refreshAttempt = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [refreshCookie!]);

      expect(refreshAttempt.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // RBAC Middleware Tests
  // ---------------------------------------------------------------------------
  describe("RBAC: requireRole middleware", () => {
    it("should block a STUDENT from an admin-only route with 403 Forbidden", async () => {
      // Login as student
      const studentLogin = await request(app).post("/api/v1/auth/login").send({
        email: testStudentEmail,
        password: testStudentPassword,
      });

      const studentCookies = studentLogin.headers["set-cookie"];

      const res = await request(app)
        .get("/api/v1/test/admin-only")
        .set("Cookie", studentCookies);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("should allow an ADMIN to access the admin-only route with 200 OK", async () => {
      // Login as seeded admin
      const adminLogin = await request(app).post("/api/v1/auth/login").send({
        email: "admin@examprep.dev",
        password: "AdminDev123!",
      });

      const adminCookies = adminLogin.headers["set-cookie"];

      const res = await request(app)
        .get("/api/v1/test/admin-only")
        .set("Cookie", adminCookies);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "admin-access-granted" });
    });
  });
});
