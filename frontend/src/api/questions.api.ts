import { apiClient } from "./apiClient";
import type {
  Question,
  CreateQuestionInput,
  UpdateQuestionInput,
  QuestionFilterParams,
  AvailableCountParams,
} from "../types/questions";
import type { PaginatedResponse } from "../types/curriculum";

export const questionsApi = {
  getQuestions(params?: QuestionFilterParams): Promise<PaginatedResponse<Question>> {
    return apiClient<PaginatedResponse<Question>>("/questions", {
      method: "GET",
      params: params as unknown as Record<string, string | number | boolean | undefined | null>,
    });
  },

  getQuestion(id: string): Promise<{ question: Question }> {
    return apiClient<{ question: Question }>(`/questions/${id}`, {
      method: "GET",
    });
  },

  createQuestion(data: CreateQuestionInput): Promise<{ question: Question }> {
    return apiClient<{ question: Question }>("/questions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateQuestion(id: string, data: UpdateQuestionInput): Promise<{ question: Question }> {
    return apiClient<{ question: Question }>(`/questions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  bulkUpdateQuestions(data: import("../types/questions").BulkUpdateQuestionsInput): Promise<{ count: number }> {
    return apiClient<{ count: number }>("/questions/bulk", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deactivateQuestion(id: string): Promise<{ question: Question }> {
    return apiClient<{ question: Question }>(`/questions/${id}/deactivate`, {
      method: "PATCH",
    });
  },

  getAvailableCount(params: AvailableCountParams): Promise<{ count: number }> {
    return apiClient<{ count: number }>("/questions/available-count", {
      method: "GET",
      params: params as unknown as Record<string, string | number | boolean | undefined | null>,
    });
  },
};
