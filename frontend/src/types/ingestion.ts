import type { Question } from "./questions";

export type IngestionStatus = "UPLOADED" | "EXTRACTING" | "EXTRACTED" | "FAILED" | "REVIEWED";

export interface IngestionBatch {
  id: string;
  uploaded_by: string;
  source_type: "PDF" | "MANUAL";
  original_filename: string;
  storage_key?: string | null;
  status: IngestionStatus;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  uploader?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CandidateOption {
  id?: string;
  text: string;
}

export interface CandidateQuestion {
  id: string;
  question_text: string;
  options: CandidateOption[];
  correct_answer: string;
  explanation?: string | null;
  question_type: "CONCEPT" | "PYQ";
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  status?: "DRAFT" | "ACTIVE";
  exam_name?: string | null;
  exam_year?: number | null;
  needsReview: boolean;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  extractionMethod?: "TEXT" | "TEXT_PLUS_VISION" | "GEMINI_DOCUMENT" | "GEMINI_HYBRID";
  sourcePages?: number[];
  reviewReason?: string | null;
  subject_id?: string;
  chapter_id?: string;
  diagram_url?: string | null;
}

export interface IngestionBatchResponse {
  batch: IngestionBatch;
  candidates: CandidateQuestion[];
}

export interface SubmitReviewedQuestionsResponse {
  batch: IngestionBatch;
  createdCount: number;
  questions: Question[];
}
