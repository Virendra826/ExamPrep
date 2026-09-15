import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../src/app.js";

describe("GET /api/v1/ping", () => {
  it("should return 200 with status ok", async () => {
    const response = await request(app).get("/api/v1/ping");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
