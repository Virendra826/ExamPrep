import { apiClient } from "./apiClient";
import type { QuizConfig, CreateQuizResponse, QuizDetails } from "../types/quiz";

export const quizApi = {
  createQuiz(data: QuizConfig): Promise<CreateQuizResponse> {
    return apiClient<CreateQuizResponse>("/quiz", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getQuiz(id: string): Promise<{ quiz: QuizDetails }> {
    return apiClient<{ quiz: QuizDetails }>(`/quiz/${id}`, {
      method: "GET",
    });
  },
};
