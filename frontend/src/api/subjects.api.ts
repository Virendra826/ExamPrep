import { apiClient } from "./apiClient";
import type {
  Subject,
  PaginatedResponse,
  CreateSubjectInput,
  UpdateSubjectInput,
} from "../types/curriculum";

export const subjectsApi = {
  getSubjects(params?: {
    page?: number;
    limit?: number;
    includeInactive?: boolean;
  }): Promise<PaginatedResponse<Subject>> {
    return apiClient<PaginatedResponse<Subject>>("/subjects", {
      method: "GET",
      params,
    });
  },

  getSubject(id: string): Promise<{ subject: Subject }> {
    return apiClient<{ subject: Subject }>(`/subjects/${id}`, {
      method: "GET",
    });
  },

  createSubject(data: CreateSubjectInput): Promise<{ subject: Subject }> {
    return apiClient<{ subject: Subject }>("/subjects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateSubject(id: string, data: UpdateSubjectInput): Promise<{ subject: Subject }> {
    return apiClient<{ subject: Subject }>(`/subjects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deactivateSubject(id: string): Promise<{ message: string; subject: Subject }> {
    return apiClient<{ message: string; subject: Subject }>(`/subjects/${id}/deactivate`, {
      method: "PATCH",
    });
  },
};
