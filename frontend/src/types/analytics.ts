export interface AnalyticsSummary {
  total_attempts: number;
  best_score: number;
  average_percentage: number;
  average_accuracy: number;
  average_time_per_question: number;
}

export interface ChapterPerformance {
  chapter_id: string;
  chapter_name: string;
  subject_name: string;
  attempt_count: number;
  average_percentage: number;
  average_accuracy: number;
}
