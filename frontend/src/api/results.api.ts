import { apiClient } from "./apiClient";
import type { QuizResultResponse } from "../types/results";

export const resultsApi = {
  getAttemptResult(attemptId: string): Promise<QuizResultResponse> {
    return apiClient<QuizResultResponse>(`/attempts/${attemptId}/result`, {
      method: "GET",
    });
  },
};
