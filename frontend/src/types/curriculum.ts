export interface Subject {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  question_count?: number;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  question_count?: number;
  subject?: {
    id: string;
    name: string;
    is_active?: boolean;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSubjectInput {
  name: string;
  description?: string | null;
}

export interface UpdateSubjectInput {
  name?: string;
  description?: string | null;
}

export interface CreateChapterInput {
  subject_id: string;
  name: string;
  description?: string | null;
}

export interface UpdateChapterInput {
  name?: string;
  description?: string | null;
}
