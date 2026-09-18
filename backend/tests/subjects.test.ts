import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

describe("Subject Management APIs (PROMPT 10)", () => {
  let adminCookies: string[];
  let studentCookies: string[];
  let testSubjectId: string;
  const testSubjectName = `Physics-Adv-${Date.now()}`;

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

  afterAll(async () => {
    // Clean up created test subject and associated records
    if (testSubjectId) {
      await prisma.chapter.deleteMany({ where: { subject_id: testSubjectId } });
      await prisma.subject.deleteMany({ where: { name: { startsWith: "Physics-Adv-" } } });
    }
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. POST /api/v1/subjects (Admin Create)
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/subjects", () => {
    it("should return 401 Unauthorized when unauthenticated", async () => {
      const res = await request(app)
        .post("/api/v1/subjects")
        .send({ name: testSubjectName });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 Forbidden when called by a STUDENT", async () => {
      const res = await request(app)
        .post("/api/v1/subjects")
        .set("Cookie", studentCookies)
        .send({ name: testSubjectName });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("should return 400 Validation Error on missing or short name", async () => {
      const res = await request(app)
        .post("/api/v1/subjects")
        .set("Cookie", adminCookies)
        .send({ name: "A" }); // min 2 chars

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should allow an ADMIN to create a subject successfully (201)", async () => {
      const res = await request(app)
        .post("/api/v1/subjects")
        .set("Cookie", adminCookies)
        .send({
          name: testSubjectName,
          description: "Advanced Physics concepts for competitive exams",
        });

      expect(res.status).toBe(201);
      expect(res.body.subject).toBeDefined();
      expect(res.body.subject.name).toBe(testSubjectName);
      expect(res.body.subject.is_active).toBe(true);
      testSubjectId = res.body.subject.id;
    });

    it("should return 409 Conflict when attempting to create duplicate subject name", async () => {
      const res = await request(app)
        .post("/api/v1/subjects")
        .set("Cookie", adminCookies)
        .send({ name: testSubjectName });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/subjects (List Paginated)
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/subjects", () => {
    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/v1/subjects");
      expect(res.status).toBe(401);
    });

    it("should allow a STUDENT to list active subjects with pagination metadata", async () => {
      const res = await request(app)
        .get("/api/v1/subjects?page=1&limit=5")
        .set("Cookie", studentCookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.data.every((s: { is_active: boolean }) => s.is_active === true)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/subjects/:id
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/subjects/:id", () => {
    it("should return 404 for non-existent subject UUID", async () => {
      const res = await request(app)
        .get("/api/v1/subjects/00000000-0000-0000-0000-000000000000")
        .set("Cookie", studentCookies);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("should return subject details with chapter_count for authenticated user", async () => {
      const res = await request(app)
        .get(`/api/v1/subjects/${testSubjectId}`)
        .set("Cookie", studentCookies);

      expect(res.status).toBe(200);
      expect(res.body.subject.id).toBe(testSubjectId);
      expect(res.body.subject.name).toBe(testSubjectName);
      expect(res.body.subject).toHaveProperty("chapter_count");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. PATCH /api/v1/subjects/:id
  // ---------------------------------------------------------------------------
  describe("PATCH /api/v1/subjects/:id", () => {
    it("should return 403 Forbidden when called by a STUDENT", async () => {
      const res = await request(app)
        .patch(`/api/v1/subjects/${testSubjectId}`)
        .set("Cookie", studentCookies)
        .send({ description: "Updated by student" });

      expect(res.status).toBe(403);
    });

    it("should return 404 when updating non-existent subject", async () => {
      const res = await request(app)
        .patch("/api/v1/subjects/00000000-0000-0000-0000-000000000000")
        .set("Cookie", adminCookies)
        .send({ description: "Should fail" });

      expect(res.status).toBe(404);
    });

    it("should allow ADMIN to update subject description", async () => {
      const res = await request(app)
        .patch(`/api/v1/subjects/${testSubjectId}`)
        .set("Cookie", adminCookies)
        .send({ description: "Updated description for test subject" });

      expect(res.status).toBe(200);
      expect(res.body.subject.description).toBe("Updated description for test subject");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. PATCH /api/v1/subjects/:id/deactivate (Soft-Deactivation)
  // ---------------------------------------------------------------------------
  describe("PATCH /api/v1/subjects/:id/deactivate", () => {
    it("should return 403 Forbidden for STUDENT", async () => {
      const res = await request(app)
        .patch(`/api/v1/subjects/${testSubjectId}/deactivate`)
        .set("Cookie", studentCookies);

      expect(res.status).toBe(403);
    });

    it("should soft-deactivate the subject and preserve database row", async () => {
      const res = await request(app)
        .patch(`/api/v1/subjects/${testSubjectId}/deactivate`)
        .set("Cookie", adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.subject.is_active).toBe(false);

      // Verify row still exists in DB
      const dbRow = await prisma.subject.findUnique({ where: { id: testSubjectId } });
      expect(dbRow).not.toBeNull();
      expect(dbRow?.is_active).toBe(false);

      // Verify student cannot see it in active list
      const studentList = await request(app)
        .get("/api/v1/subjects")
        .set("Cookie", studentCookies);
      expect(studentList.body.data.some((s: { id: string }) => s.id === testSubjectId)).toBe(false);

      // Verify admin can see it with ?includeInactive=true
      const adminList = await request(app)
        .get("/api/v1/subjects?includeInactive=true")
        .set("Cookie", adminCookies);
      expect(adminList.body.data.some((s: { id: string }) => s.id === testSubjectId)).toBe(true);
    });
  });
});
