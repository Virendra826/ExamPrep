import type { AttemptStatus, QuestionOptionItem } from './attempts';

export interface QuizResultData {
  id: string;
  attempt_id: string;
  total_questions: number;
  attempted_count: number;
  correct_count: number;
  incorrect_count: number;
  unattempted_count: number;
  marks_obtained: number;
  total_marks: number;
  percentage: number;
  accuracy: number;
  time_taken_seconds: number;
  evaluated_at: string;
}

export interface QuestionReviewItem {
  quiz_question_id: string;
  display_order: number;
  question_id: string;
  question_text: string;
  options: QuestionOptionItem[];
  question_type: 'CONCEPT' | 'PYQ';
  difficulty?: string | null;
  exam_name?: string | null;
  exam_year?: number | null;
  selected_option: string | null;
  correct_answer: string;
  is_correct: boolean;
  explanation: string | null;
}

export interface QuizResultResponse {
  attempt: {
    id: string;
    status: AttemptStatus;
    started_at: string | null;
    submitted_at: string | null;
    time_taken_seconds: number | null;
    created_at: string;
  };
  quiz: {
    id: string;
    subject: { id: string; name: string };
    chapter?: { id: string; name: string } | null;
    question_type_filter: string;
    requested_count: number;
  };
  result: QuizResultData;
  questions: QuestionReviewItem[];
}
