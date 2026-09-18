import { QuestionType, QuestionStatus, Difficulty } from '@prisma/client';

export interface CandidateOption {
  id?: string;
  text: string;
}

export interface CandidateQuestion {
  id: string; // temporary unique client ID (e.g. candidate-uuid)
  question_text: string;
  options: CandidateOption[];
  correct_answer: string;
  explanation?: string | null;
  question_type: QuestionType;
  difficulty?: Difficulty | null;
  status?: QuestionStatus;
  exam_name?: string | null;
  exam_year?: number | null;
  needsReview: boolean;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  extractionMethod?: 'TEXT' | 'TEXT_PLUS_VISION';
  sourcePages?: number[];
  reviewReason?: string | null;
  subject_id?: string;
  chapter_id?: string;
  diagram_url?: string | null;
}
