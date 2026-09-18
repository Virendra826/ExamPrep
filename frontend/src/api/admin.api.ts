import { apiClient } from "./apiClient";
import type { AdminDashboardSummary } from "../types/admin";

export const adminApi = {
  getDashboardSummary(): Promise<{ summary: AdminDashboardSummary }> {
    return apiClient<{ summary: AdminDashboardSummary }>("/admin/dashboard-summary", {
      method: "GET",
    });
  },
};
