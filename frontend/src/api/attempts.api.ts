import { apiClient } from "./apiClient";
import type {
  AttemptStateResponse,
  StartAttemptResponse,
  SubmitAttemptResponse,
  SaveAnswerResponse,
  AttemptHistoryItem,
} from "../types/attempts";
import type { PaginatedResponse } from "../types/curriculum";

export const attemptsApi = {
  getAttempt(attemptId: string): Promise<AttemptStateResponse> {
    return apiClient<AttemptStateResponse>(`/attempts/${attemptId}`, {
      method: "GET",
    });
  },

  startAttempt(attemptId: string): Promise<StartAttemptResponse> {
    return apiClient<StartAttemptResponse>(`/attempts/${attemptId}/start`, {
      method: "POST",
    });
  },

  saveAnswer(
    attemptId: string,
    quizQuestionId: string,
    selectedOption: string | null
  ): Promise<SaveAnswerResponse> {
    return apiClient<SaveAnswerResponse>(`/attempts/${attemptId}/answers/${quizQuestionId}`, {
      method: "PUT",
      body: JSON.stringify({ selected_option: selectedOption }),
    });
  },

  submitAttempt(attemptId: string): Promise<SubmitAttemptResponse> {
    return apiClient<SubmitAttemptResponse>(`/attempts/${attemptId}/submit`, {
      method: "POST",
    });
  },

  timeoutAttempt(attemptId: string): Promise<SubmitAttemptResponse> {
    return apiClient<SubmitAttemptResponse>(`/attempts/${attemptId}/timeout`, {
      method: "POST",
    });
  },

  getHistory(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AttemptHistoryItem>> {
    return apiClient<PaginatedResponse<AttemptHistoryItem>>("/attempts", {
      method: "GET",
      params,
    });
  },
};
