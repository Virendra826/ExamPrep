import { apiClient } from "./apiClient";
import type { AuthResponse, MessageResponse } from "../types/auth";
import type { LoginInput, RegisterInput } from "../validation/auth";

export const authApi = {
  register(data: RegisterInput): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  login(data: LoginInput): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  logout(): Promise<MessageResponse> {
    return apiClient<MessageResponse>("/auth/logout", {
      method: "POST",
    });
  },

  me(): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/auth/me", {
      method: "GET",
    });
  },

  refresh(): Promise<AuthResponse> {
    return apiClient<AuthResponse>("/auth/refresh", {
      method: "POST",
    });
  },
};
