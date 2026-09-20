import request from "supertest";
import { describe, it, expect, afterAll, vi } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { geminiExtractionService } from "../src/modules/ingestion/gemini/geminiExtraction.service.js";

describe("Health & Centralized Error Handler", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET /api/v1/health should return 200 with status ok, db connected, and extraction configuration", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.db).toBe("connected");
    expect(response.body.extraction).toBeDefined();
    expect(typeof response.body.extraction.engine).toBe("string");
    expect(typeof response.body.extraction.geminiConfigured).toBe("boolean");
  });

  it("GET /api/v1/health safely reports geminiConfigured boolean without leaking API keys", async () => {
    // 1. Test when gemini is unconfigured
    const unconfigSpy = vi.spyOn(geminiExtractionService, "isConfigured").mockReturnValueOnce(false);
    const unconfigRes = await request(app).get("/api/v1/health");
    expect(unconfigRes.status).toBe(200);
    expect(unconfigRes.body.extraction.geminiConfigured).toBe(false);
    unconfigSpy.mockRestore();

    // 2. Test when gemini is configured
    const configSpy = vi.spyOn(geminiExtractionService, "isConfigured").mockReturnValueOnce(true);
    const configRes = await request(app).get("/api/v1/health");
    expect(configRes.status).toBe(200);
    expect(configRes.body.extraction.geminiConfigured).toBe(true);
    configSpy.mockRestore();

    // 3. Security assertion: ensure no API key or sensitive credentials appear anywhere in payload
    const rawBody = JSON.stringify(configRes.body);
    expect(rawBody).not.toMatch(/AIzaSy/i);
    expect(rawBody).not.toMatch(/GEMINI_API_KEY/i);
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
