import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, ApiError } from "../api/apiClient";

describe("apiClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends credentials: 'include' and parses JSON response on success", async () => {
    const mockData = { user: { id: "1", name: "Alice" } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as unknown as Response);

    const result = await apiClient<{ user: { id: string; name: string } }>("/test-endpoint");

    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/test-endpoint"),
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("throws ApiError with statusCode, code, and message on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email is required",
        },
      }),
    } as unknown as Response);

    await expect(apiClient("/bad")).rejects.toThrowError(ApiError);

    try {
      await apiClient("/bad");
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBe(400);
      expect(apiErr.code).toBe("VALIDATION_ERROR");
      expect(apiErr.message).toBe("Email is required");
    }
  });

  it("silently refreshes token on 401 with TOKEN_EXPIRED and retries request once", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes("/auth/refresh")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ user: { id: "1" } }),
        } as unknown as Response;
      }

      if (callCount === 1) {
        // First call fails with TOKEN_EXPIRED
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: {
              code: "TOKEN_EXPIRED",
              message: "Access token has expired",
            },
          }),
        } as unknown as Response;
      }

      // Second call (retry) succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: "success-after-refresh" }),
      } as unknown as Response;
    });

    const result = await apiClient<{ data: string }>("/protected-data");
    expect(result).toEqual({ data: "success-after-refresh" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/refresh"),
      expect.objectContaining({ method: "POST", credentials: "include" })
    );
  });
});
