import { apiClient } from "./apiClient";
import type {
  IngestionBatchResponse,
  SubmitReviewedQuestionsResponse,
  CandidateQuestion,
} from "../types/ingestion";

export const ingestionApi = {
  uploadPdf(file: File): Promise<IngestionBatchResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient<IngestionBatchResponse>("/ingestion/upload", {
      method: "POST",
      body: formData,
    });
  },

  getBatch(batchId: string): Promise<IngestionBatchResponse> {
    return apiClient<IngestionBatchResponse>(`/ingestion/${batchId}`, {
      method: "GET",
    });
  },

  submitQuestions(
    batchId: string,
    questions: CandidateQuestion[]
  ): Promise<SubmitReviewedQuestionsResponse> {
    return apiClient<SubmitReviewedQuestionsResponse>(`/ingestion/${batchId}/questions`, {
      method: "POST",
      body: JSON.stringify({ questions }),
    });
  },
};
