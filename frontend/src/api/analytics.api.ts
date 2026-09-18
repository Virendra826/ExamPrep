import { apiClient } from "./apiClient";
import type { AnalyticsSummary, ChapterPerformance } from "../types/analytics";

export const analyticsApi = {
  getSummary(): Promise<{ summary: AnalyticsSummary }> {
    return apiClient<{ summary: AnalyticsSummary }>("/analytics/summary", {
      method: "GET",
    });
  },

  getChapterPerformance(): Promise<{ chapters: ChapterPerformance[] }> {
    return apiClient<{ chapters: ChapterPerformance[] }>("/analytics/chapter-performance", {
      method: "GET",
    });
  },
};
