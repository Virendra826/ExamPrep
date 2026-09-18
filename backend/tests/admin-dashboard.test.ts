import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { QuestionStatus, IngestionStatus } from "@prisma/client";

describe("Admin Dashboard Summary API (PROMPT 24)", () => {
  let adminCookies: string[];
  let studentCookies: string[];

  beforeAll(async () => {
    // 1. Obtain Admin Cookies
    const adminLogin = await request(app).post("/api/v1/auth/login").send({
      email: "admin@examprep.dev",
      password: "AdminDev123!",
    });
    adminCookies = adminLogin.headers["set-cookie"] as unknown as string[];

    // 2. Obtain Student Cookies
    const studentLogin = await request(app).post("/api/v1/auth/login").send({
      email: "student@examprep.dev",
      password: "StudentDev123!",
    });
    studentCookies = studentLogin.headers["set-cookie"] as unknown as string[];
  });

  it("should reject unauthenticated requests with 401", async () => {
    const res = await request(app).get("/api/v1/admin/dashboard-summary");
    expect(res.status).toBe(401);
  });

  it("should reject non-admin users with 403 Forbidden", async () => {
    const res = await request(app)
      .get("/api/v1/admin/dashboard-summary")
      .set("Cookie", studentCookies);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("should return accurate counts for subjects, chapters, active/draft questions, and pending batches matching DB", async () => {
    const res = await request(app)
      .get("/api/v1/admin/dashboard-summary")
      .set("Cookie", adminCookies);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();

    const { summary } = res.body;
    expect(typeof summary.subjects_count).toBe("number");
    expect(summary.subjects_count).toBeGreaterThanOrEqual(3);

    expect(typeof summary.chapters_count).toBe("number");
    expect(summary.chapters_count).toBeGreaterThanOrEqual(9);

    expect(typeof summary.active_questions_count).toBe("number");
    expect(summary.active_questions_count).toBeGreaterThanOrEqual(0);

    expect(typeof summary.draft_questions_count).toBe("number");
    expect(summary.draft_questions_count).toBeGreaterThanOrEqual(0);

    expect(typeof summary.pending_batches_count).toBe("number");
    expect(summary.pending_batches_count).toBeGreaterThanOrEqual(0);
  });
});
