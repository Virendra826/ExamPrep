export type QuestionType = "CONCEPT" | "PYQ";
export type QuestionStatus = "DRAFT" | "ACTIVE" | "INACTIVE";
export type QuestionSource = "PDF" | "MANUAL";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface QuestionOption {
  id?: string;
  text: string;
}

export interface Question {
  id: string;
  question_text: string;
  options: QuestionOption[];
  correct_answer: string;
  explanation: string | null;
  subject_id: string;
  chapter_id: string;
  question_type: QuestionType;
  source: QuestionSource;
  exam_name: string | null;
  exam_year: number | null;
  difficulty: Difficulty | null;
  status: QuestionStatus;
  ingestion_batch_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  subject?: {
    id: string;
    name: string;
  };
  chapter?: {
    id: string;
    name: string;
  };
}

export interface CreateQuestionInput {
  question_text: string;
  options: QuestionOption[];
  correct_answer: string;
  subject_id: string;
  chapter_id: string;
  question_type: QuestionType;
  difficulty?: Difficulty | null;
  status?: QuestionStatus;
  exam_name?: string | null;
  exam_year?: number | null;
  explanation?: string | null;
}

export interface UpdateQuestionInput {
  question_text?: string;
  options?: QuestionOption[];
  correct_answer?: string;
  subject_id?: string;
  chapter_id?: string;
  question_type?: QuestionType;
  difficulty?: Difficulty | null;
  status?: QuestionStatus;
  exam_name?: string | null;
  exam_year?: number | null;
  explanation?: string | null;
}

export interface QuestionFilterParams {
  page?: number;
  limit?: number;
  subject_id?: string;
  chapter_id?: string;
  question_type?: QuestionType;
  difficulty?: Difficulty;
  status?: QuestionStatus;
  search?: string;
}

export interface BulkUpdateQuestionsInput {
  ids?: string[];
  filter?: {
    subject_id?: string;
    chapter_id?: string;
    question_type?: QuestionType;
    difficulty?: Difficulty;
    status?: QuestionStatus;
    search?: string;
  };
  updates: {
    status?: QuestionStatus;
    difficulty?: Difficulty | null;
  };
}

export interface AvailableCountParams {
  subjectId: string;
  chapterId?: string;
  type?: "CONCEPT" | "PYQ" | "BOTH";
}

