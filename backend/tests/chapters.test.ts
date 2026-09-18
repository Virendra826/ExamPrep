import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

describe("Chapter Management APIs (PROMPT 10)", () => {
  let adminCookies: string[];
  let studentCookies: string[];
  let testSubjectId: string;
  let testChapterId: string;
  const testSubjectName = `Math-Adv-${Date.now()}`;
  const testChapterName = `Calculus-I-${Date.now()}`;

  beforeAll(async () => {
    // 1. Obtain Admin & Student Cookies
    const [adminLogin, studentLogin] = await Promise.all([
      request(app).post("/api/v1/auth/login").send({
        email: "admin@examprep.dev",
        password: "AdminDev123!",
      }),
      request(app).post("/api/v1/auth/login").send({
        email: "student@examprep.dev",
        password: "StudentDev123!",
      }),
    ]);

    adminCookies = adminLogin.headers["set-cookie"] as unknown as string[];
    studentCookies = studentLogin.headers["set-cookie"] as unknown as string[];

    // Create a parent subject for test chapters
    const subject = await prisma.subject.create({
      data: {
        name: testSubjectName,
        description: "Parent subject for testing chapters",
      },
    });
    testSubjectId = subject.id;
  });

  afterAll(async () => {
    // Cleanup
    if (testSubjectId) {
      await prisma.chapter.deleteMany({ where: { subject_id: testSubjectId } });
      await prisma.subject.delete({ where: { id: testSubjectId } });
    }
    await prisma.$disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. POST /api/v1/chapters (Create Chapter)
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/chapters", () => {
    it("should return 401 Unauthorized when unauthenticated", async () => {
      const res = await request(app).post("/api/v1/chapters").send({
        subject_id: testSubjectId,
        name: testChapterName,
      });

      expect(res.status).toBe(401);
    });

    it("should return 403 Forbidden when called by a STUDENT", async () => {
      const res = await request(app)
        .post("/api/v1/chapters")
        .set("Cookie", studentCookies)
        .send({
          subject_id: testSubjectId,
          name: testChapterName,
        });

      expect(res.status).toBe(403);
    });

    it("should return 400 Validation Error if name is empty", async () => {
      const res = await request(app)
        .post("/api/v1/chapters")
        .set("Cookie", adminCookies)
        .send({
          subject_id: testSubjectId,
          name: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 404 if parent subject does not exist", async () => {
      const res = await request(app)
        .post("/api/v1/chapters")
        .set("Cookie", adminCookies)
        .send({
          subject_id: "00000000-0000-0000-0000-000000000000",
          name: testChapterName,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("should allow ADMIN to create chapter under parent subject (201)", async () => {
      const res = await request(app)
        .post("/api/v1/chapters")
        .set("Cookie", adminCookies)
        .send({
          subject_id: testSubjectId,
          name: testChapterName,
          description: "Limits and derivatives",
        });

      expect(res.status).toBe(201);
      expect(res.body.chapter).toBeDefined();
      expect(res.body.chapter.name).toBe(testChapterName);
      expect(res.body.chapter.subject_id).toBe(testSubjectId);
      expect(res.body.chapter.is_active).toBe(true);
      testChapterId = res.body.chapter.id;
    });

    it("should return 409 Conflict if duplicate (subject_id, name) is attempted", async () => {
      const res = await request(app)
        .post("/api/v1/chapters")
        .set("Cookie", adminCookies)
        .send({
          subject_id: testSubjectId,
          name: testChapterName,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/subjects/:subjectId/chapters (List by Subject)
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/subjects/:subjectId/chapters", () => {
    it("should allow a STUDENT to list chapters under subject with pagination", async () => {
      const res = await request(app)
        .get(`/api/v1/subjects/${testSubjectId}/chapters?page=1&limit=10`)
        .set("Cookie", studentCookies);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(res.body.data.some((c: { id: string }) => c.id === testChapterId)).toBe(true);
    });

    it("should return 404 for non-existent subject", async () => {
      const res = await request(app)
        .get("/api/v1/subjects/00000000-0000-0000-0000-000000000000/chapters")
        .set("Cookie", studentCookies);

      expect(res.status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/chapters/:id (Get Chapter)
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/chapters/:id", () => {
    it("should return 404 for non-existent chapter ID", async () => {
      const res = await request(app)
        .get("/api/v1/chapters/00000000-0000-0000-0000-000000000000")
        .set("Cookie", studentCookies);

      expect(res.status).toBe(404);
    });

    it("should return chapter details for authenticated user", async () => {
      const res = await request(app)
        .get(`/api/v1/chapters/${testChapterId}`)
        .set("Cookie", studentCookies);

      expect(res.status).toBe(200);
      expect(res.body.chapter.id).toBe(testChapterId);
      expect(res.body.chapter.name).toBe(testChapterName);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. PATCH /api/v1/chapters/:id (Update Chapter)
  // ---------------------------------------------------------------------------
  describe("PATCH /api/v1/chapters/:id", () => {
    it("should return 403 Forbidden for STUDENT", async () => {
      const res = await request(app)
        .patch(`/api/v1/chapters/${testChapterId}`)
        .set("Cookie", studentCookies)
        .send({ description: "Student cannot edit" });

      expect(res.status).toBe(403);
    });

    it("should allow ADMIN to update chapter description", async () => {
      const res = await request(app)
        .patch(`/api/v1/chapters/${testChapterId}`)
        .set("Cookie", adminCookies)
        .send({ description: "Updated chapter details" });

      expect(res.status).toBe(200);
      expect(res.body.chapter.description).toBe("Updated chapter details");
    });
  });

  // ---------------------------------------------------------------------------
  // 5. PATCH /api/v1/chapters/:id/deactivate (Soft-Deactivation)
  // ---------------------------------------------------------------------------
  describe("PATCH /api/v1/chapters/:id/deactivate", () => {
    it("should return 403 Forbidden for STUDENT", async () => {
      const res = await request(app)
        .patch(`/api/v1/chapters/${testChapterId}/deactivate`)
        .set("Cookie", studentCookies);

      expect(res.status).toBe(403);
    });

    it("should soft-deactivate chapter without deleting it from DB", async () => {
      const res = await request(app)
        .patch(`/api/v1/chapters/${testChapterId}/deactivate`)
        .set("Cookie", adminCookies);

      expect(res.status).toBe(200);
      expect(res.body.chapter.is_active).toBe(false);

      // Verify row still exists in database
      const dbRow = await prisma.chapter.findUnique({ where: { id: testChapterId } });
      expect(dbRow).not.toBeNull();
      expect(dbRow?.is_active).toBe(false);

      // Student listing excludes it
      const studentList = await request(app)
        .get(`/api/v1/subjects/${testSubjectId}/chapters`)
        .set("Cookie", studentCookies);
      expect(studentList.body.data.some((c: { id: string }) => c.id === testChapterId)).toBe(false);

      // Admin can see it with ?includeInactive=true
      const adminList = await request(app)
        .get(`/api/v1/subjects/${testSubjectId}/chapters?includeInactive=true`)
        .set("Cookie", adminCookies);
      expect(adminList.body.data.some((c: { id: string }) => c.id === testChapterId)).toBe(true);
    });
  });
});
