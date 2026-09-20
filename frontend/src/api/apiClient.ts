import type { ApiErrorPayload, ApiErrorDetail } from "../types/auth";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const API_BASE_URL = (() => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/+$/, "");
  if (!envUrl) return "http://localhost:4000/api/v1";
  return envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`;
})();

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  _retry?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: Array<(success: boolean) => void> = [];

function subscribeTokenRefresh(cb: (success: boolean) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(success: boolean) {
  refreshSubscribers.forEach((cb) => cb(success));
  refreshSubscribers = [];
}

/**
 * Execute silent refresh via POST /auth/refresh with credentials: 'include'.
 */
async function silentRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, _retry = false, headers = {}, ...customConfig } = options;

  let url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const isFormData = customConfig.body instanceof FormData;
  const defaultHeaders: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...headers,
  };

  const response = await fetch(url, {
    credentials: "include",
    headers: defaultHeaders,
    ...customConfig,
  });

  if (response.ok) {
    // 204 No Content
    if (response.status === 204) {
      return {} as T;
    }
    return (await response.json()) as T;
  }

  // Parse error response
  let errorData: ApiErrorPayload | null = null;
  try {
    errorData = (await response.json()) as ApiErrorPayload;
  } catch {
    // Non-JSON error response
    errorData = null;
  }

  const statusCode = response.status;
  const errorCode = errorData?.error?.code || (statusCode === 401 ? "UNAUTHORIZED" : "UNKNOWN_ERROR");
  const errorDetails = errorData?.error?.details;
  const detailMessage =
    errorDetails && errorDetails.length > 0
      ? errorDetails.map((d) => (d.field ? `${d.field}: ${d.message}` : d.message)).join("; ")
      : "";
  const errorMessage = detailMessage
    ? `${errorData?.error?.message || "Validation failed"}: ${detailMessage}`
    : errorData?.error?.message || response.statusText || "An unexpected error occurred";

  // Check if silent token refresh is appropriate:
  // Must be 401, error code "TOKEN_EXPIRED", not already a retry, and not an auth endpoint (login/refresh)
  const isAuthEndpoint = url.includes("/auth/refresh") || url.includes("/auth/login") || url.includes("/auth/register");

  if (statusCode === 401 && errorCode === "TOKEN_EXPIRED" && !_retry && !isAuthEndpoint) {
    if (!isRefreshing) {
      isRefreshing = true;
      const refreshSuccess = await silentRefresh();
      isRefreshing = false;
      onRefreshed(refreshSuccess);

      if (refreshSuccess) {
        return apiClient<T>(endpoint, { ...options, _retry: true });
      }
    } else {
      // Another refresh is in-flight, wait for it
      const refreshSuccess = await new Promise<boolean>((resolve) => {
        subscribeTokenRefresh((success) => resolve(success));
      });

      if (refreshSuccess) {
        return apiClient<T>(endpoint, { ...options, _retry: true });
      }
    }
  }

  throw new ApiError(statusCode, errorCode, errorMessage, errorDetails);
}
