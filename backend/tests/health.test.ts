import request from "supertest";
import { describe, it, expect, afterAll } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

describe("Health & Centralized Error Handler", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET /api/v1/health should return 200 with status ok and db connected", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      db: "connected",
    });
  });

  it("should return consistent error shape on forced error route", async () => {
    const response = await request(app).get("/api/v1/test/forced-error");
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Forced validation error for testing.",
      },
    });
  });

  it("should return consistent error shape on non-existent route (404)", async () => {
    const response = await request(app).get("/api/v1/non-existent-endpoint");
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty("error");
    expect(response.body.error).toEqual({
      code: "NOT_FOUND",
      message: "Requested API route does not exist.",
    });
  });
});
