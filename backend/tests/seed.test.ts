import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { Role, QuestionType, QuestionStatus } from "@prisma/client";

describe("Database Seed Verification", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds exactly the expected two users (admin and student)", async () => {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@examprep.dev" },
    });
    const student = await prisma.user.findUnique({
      where: { email: "student@examprep.dev" },
    });

    expect(admin).not.toBeNull();
    expect(admin?.role).toBe(Role.ADMIN);
    expect(admin?.password_hash).toMatch(/^\$2[aby]\$\d+\$/); // Valid bcrypt hash

    expect(student).not.toBeNull();
    expect(student?.role).toBe(Role.STUDENT);
    expect(student?.password_hash).toMatch(/^\$2[aby]\$\d+\$/); // Valid bcrypt hash
  });

  it("seeds the 3 core subjects", async () => {
    const subjects = await prisma.subject.findMany({
      orderBy: { name: "asc" },
    });

    expect(subjects).toHaveLength(3);
    const subjectNames = subjects.map((s) => s.name);
    expect(subjectNames).toEqual(["Compiler Design", "DBMS", "Operating Systems"]);
  });

  it("seeds exactly 3 chapters for each subject (9 chapters total)", async () => {
    const chapters = await prisma.chapter.findMany({
      include: { subject: true },
    });

    expect(chapters).toHaveLength(9);

    const countsBySubject: Record<string, number> = {};
    for (const ch of chapters) {
      countsBySubject[ch.subject.name] = (countsBySubject[ch.subject.name] || 0) + 1;
    }

    expect(countsBySubject["Compiler Design"]).toBe(3);
    expect(countsBySubject["Operating Systems"]).toBe(3);
    expect(countsBySubject["DBMS"]).toBe(3);
  });

  it("seeds exactly 30 questions with 10 questions per subject, mixing CONCEPT and PYQ", async () => {
    const questions = await prisma.question.findMany({
      include: { subject: true },
    });

    expect(questions).toHaveLength(30);

    const countsBySubject: Record<string, number> = {};
    let conceptCount = 0;
    let pyqCount = 0;

    for (const q of questions) {
      countsBySubject[q.subject.name] = (countsBySubject[q.subject.name] || 0) + 1;
      expect(q.status).toBe(QuestionStatus.ACTIVE);
      expect(Array.isArray(q.options)).toBe(true);
      expect(["A", "B", "C", "D"]).toContain(q.correct_answer);

      if (q.question_type === QuestionType.CONCEPT) {
        conceptCount++;
        expect(q.exam_name).toBeNull();
        expect(q.exam_year).toBeNull();
      } else if (q.question_type === QuestionType.PYQ) {
        pyqCount++;
        expect(q.exam_name).toBeTruthy();
        expect(q.exam_year).toBeGreaterThanOrEqual(2000);
      }
    }

    expect(countsBySubject["Compiler Design"]).toBe(10);
    expect(countsBySubject["Operating Systems"]).toBe(10);
    expect(countsBySubject["DBMS"]).toBe(10);

    expect(conceptCount).toBe(15);
    expect(pyqCount).toBe(15);
  });
});
