import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/config/prisma.js";

describe("Prisma Database Connectivity", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("successfully connects and queries user count", async () => {
    const userCount = await prisma.user.count();
    expect(userCount).toBeTypeOf("number");
    expect(userCount).toBeGreaterThanOrEqual(0);
  });

  it("can query subjects table without errors", async () => {
    const subjects = await prisma.subject.findMany();
    expect(Array.isArray(subjects)).toBe(true);
  });
});
