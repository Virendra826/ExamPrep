export type AttemptStatus =
  | 'CREATED'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'TIMEOUT'
  | 'SUBMITTED'
  | 'EVALUATED';

export interface QuestionOptionObject {
  id?: string;
  text: string;
}

export type QuestionOptionItem = QuestionOptionObject | string;

export interface AttemptQuestion {
  quiz_question_id: string;
  display_order: number;
  question_id: string;
  question_text: string;
  options: QuestionOptionItem[];
  question_type: 'CONCEPT' | 'PYQ';
  difficulty?: string | null;
  exam_name?: string | null;
  exam_year?: number | null;
}

export interface SubmittedAnswerState {
  id?: string;
  quiz_question_id: string;
  selected_option: string | null;
  answered_at?: string | null;
}

export interface AttemptStateResponse {
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
    order_mode: string;
    timer_mode: string;
    timer_duration_seconds?: number | null;
  };
  questions: AttemptQuestion[];
  submitted_answers: SubmittedAnswerState[];
  serverTimeRemainingSeconds?: number | null;
  serverElapsedSeconds?: number | null;
}

export interface StartAttemptResponse {
  attemptId: string;
  status: AttemptStatus;
  started_at: string;
}

export interface SubmitAttemptResponse {
  attemptId: string;
  status: AttemptStatus;
  submitted_at: string;
  time_taken_seconds: number;
}

export interface SaveAnswerResponse {
  answer: {
    id: string;
    quiz_question_id: string;
    selected_option: string | null;
    answered_at: string;
  };
}

export interface AttemptHistoryItem {
  id: string;
  quiz_id: string;
  quiz: {
    id?: string;
    subject: { id: string; name: string };
    chapter?: { id: string; name: string } | null;
    question_type_filter: string;
    requested_count: number;
    timer_mode: string;
    timer_duration_seconds?: number | null;
  };
  status: AttemptStatus;
  started_at: string | null;
  submitted_at: string | null;
  time_taken_seconds: number | null;
  created_at: string;
  score?: number | null;
  total_marks?: number | null;
  percentage?: number | null;
  accuracy?: number | null;
}
