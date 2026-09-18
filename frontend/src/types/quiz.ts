export type QuestionTypeFilter = 'CONCEPT' | 'PYQ' | 'BOTH';
export type OrderMode = 'SEQUENTIAL' | 'RANDOM';
export type TimerMode = 'FIXED' | 'VARIABLE';

export interface QuizConfig {
  subject_id: string;
  chapter_id?: string | null;
  question_type_filter: QuestionTypeFilter;
  requested_count: number;
  order_mode: OrderMode;
  timer_mode: TimerMode;
  timer_duration_seconds?: number | null;
}

export interface CreateQuizResponse {
  quizId: string;
  attemptId: string;
}

export interface QuizDetails {
  id: string;
  subject: { id: string; name: string };
  chapter?: { id: string; name: string } | null;
  question_type_filter: QuestionTypeFilter;
  requested_count: number;
  actual_question_count: number;
  order_mode: OrderMode;
  timer_mode: TimerMode;
  timer_duration_seconds?: number | null;
  created_at: string;
}
