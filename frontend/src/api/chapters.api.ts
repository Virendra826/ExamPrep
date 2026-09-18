import { apiClient } from "./apiClient";
import type {
  Chapter,
  PaginatedResponse,
  CreateChapterInput,
  UpdateChapterInput,
} from "../types/curriculum";

export const chaptersApi = {
  getChaptersBySubject(
    subjectId: string,
    params?: {
      page?: number;
      limit?: number;
      includeInactive?: boolean;
    }
  ): Promise<PaginatedResponse<Chapter>> {
    return apiClient<PaginatedResponse<Chapter>>(`/subjects/${subjectId}/chapters`, {
      method: "GET",
      params,
    });
  },

  getChapters(
    subjectId: string,
    params?: {
      page?: number;
      limit?: number;
      includeInactive?: boolean;
    }
  ): Promise<PaginatedResponse<Chapter>> {
    return this.getChaptersBySubject(subjectId, params);
  },

  getChapter(id: string): Promise<{ chapter: Chapter }> {
    return apiClient<{ chapter: Chapter }>(`/chapters/${id}`, {
      method: "GET",
    });
  },

  createChapter(data: CreateChapterInput): Promise<{ chapter: Chapter }> {
    return apiClient<{ chapter: Chapter }>("/chapters", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateChapter(id: string, data: UpdateChapterInput): Promise<{ chapter: Chapter }> {
    return apiClient<{ chapter: Chapter }>(`/chapters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deactivateChapter(id: string): Promise<{ message: string; chapter: Chapter }> {
    return apiClient<{ message: string; chapter: Chapter }>(`/chapters/${id}/deactivate`, {
      method: "PATCH",
    });
  },
};
