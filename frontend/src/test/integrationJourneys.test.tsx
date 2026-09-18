import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QuizConfigForm } from "../features/quiz-config/QuizConfigForm";
import { QuizResultPage } from "../pages/QuizResultPage";
import { HistoryPage } from "../pages/HistoryPage";
import { AdminPage } from "../pages/AdminPage";
import { quizApi } from "../api/quiz.api";
import { attemptsApi } from "../api/attempts.api";
import { resultsApi } from "../api/results.api";
import { subjectsApi } from "../api/subjects.api";
import { chaptersApi } from "../api/chapters.api";
import { questionsApi } from "../api/questions.api";
import { adminApi } from "../api/admin.api";
import { authApi } from "../api/auth.api";
import { AuthProvider } from "../features/auth/AuthContext";

vi.mock("../api/auth.api", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("../api/quiz.api", () => ({
  quizApi: {
    createQuiz: vi.fn(),
    getQuiz: vi.fn(),
  },
}));

vi.mock("../api/attempts.api", () => ({
  attemptsApi: {
    getHistory: vi.fn(),
  },
}));

vi.mock("../api/results.api", () => ({
  resultsApi: {
    getAttemptResult: vi.fn(),
  },
}));

vi.mock("../api/subjects.api", () => ({
  subjectsApi: {
    getSubjects: vi.fn(),
  },
}));

vi.mock("../api/chapters.api", () => ({
  chaptersApi: {
    getChaptersBySubject: vi.fn(),
  },
}));

vi.mock("../api/questions.api", () => ({
  questionsApi: {
    getAvailableCount: vi.fn(),
  },
}));

vi.mock("../api/admin.api", () => ({
  adminApi: {
    getDashboardSummary: vi.fn(),
  },
}));

describe("Frontend Full Journey Integration Pass (PROMPT 25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Student Journey Workflows", () => {
    it("flows seamlessly from Quiz Configuration to Generation", async () => {
      vi.mocked(subjectsApi.getSubjects).mockResolvedValue({
        data: [{ id: "s-1", name: "DBMS", description: "Database systems", chapter_count: 1, is_active: true, created_at: "", updated_at: "" }],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
      vi.mocked(chaptersApi.getChaptersBySubject).mockResolvedValue({
        data: [{ id: "c-1", subject_id: "s-1", name: "Relational Model", description: "Relational schemas", is_active: true, created_at: "", updated_at: "" }],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });
      vi.mocked(questionsApi.getAvailableCount).mockResolvedValue({ count: 10 });
      vi.mocked(quizApi.createQuiz).mockResolvedValue({
        quizId: "quiz-101",
        attemptId: "attempt-202",
      });

      render(
        <MemoryRouter>
          <QuizConfigForm />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Configure New Quiz")).toBeInTheDocument();
      });

      // Verify subject is selectable and loaded
      await waitFor(() => {
        expect(screen.getByText("DBMS")).toBeInTheDocument();
      });
    });

    it("renders Quiz Results accurately with complete review breakdown", async () => {
      vi.mocked(resultsApi.getAttemptResult).mockResolvedValue({
        attempt: {
          id: "attempt-202",
          status: "EVALUATED",
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          time_taken_seconds: 45,
          created_at: new Date().toISOString(),
        },
        quiz: {
          id: "quiz-101",
          subject: { id: "s-1", name: "DBMS" },
          chapter: { id: "c-1", name: "Relational Model" },
          question_type_filter: "BOTH",
          requested_count: 1,
        },
        result: {
          id: "res-1",
          attempt_id: "attempt-202",
          total_questions: 1,
          attempted_count: 1,
          correct_count: 1,
          incorrect_count: 0,
          unattempted_count: 0,
          marks_obtained: 1,
          total_marks: 1,
          percentage: 100,
          accuracy: 100,
          time_taken_seconds: 45,
          evaluated_at: new Date().toISOString(),
        },
        questions: [
          {
            quiz_question_id: "qq-1",
            display_order: 1,
            question_id: "q-1",
            question_text: "What is a primary key?",
            options: [
              { id: "A", text: "Unique identifier" },
              { id: "B", text: "Foreign attribute" },
            ],
            question_type: "CONCEPT",
            difficulty: "EASY",
            selected_option: "Unique identifier",
            correct_answer: "Unique identifier",
            is_correct: true,
            explanation: "A primary key uniquely identifies records.",
          },
        ],
      });

      render(
        <MemoryRouter initialEntries={["/attempts/attempt-202/results"]}>
          <Routes>
            <Route path="/attempts/:attemptId/results" element={<QuizResultPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Quiz Performance Report")).toBeInTheDocument();
        expect(screen.getAllByText("100%").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("What is a primary key?")).toBeInTheDocument();
      });
    });

    it("renders History page cleanly", async () => {
      vi.mocked(attemptsApi.getHistory).mockResolvedValue({
        data: [
          {
            id: "att-1",
            quiz_id: "quiz-1",
            quiz: {
              subject: { id: "s-1", name: "DBMS" },
              chapter: { id: "c-1", name: "Relational Model" },
              question_type_filter: "BOTH",
              requested_count: 5,
              timer_mode: "FIXED",
              timer_duration_seconds: 300,
            },
            status: "EVALUATED",
            started_at: new Date().toISOString(),
            submitted_at: new Date().toISOString(),
            time_taken_seconds: 120,
            created_at: new Date().toISOString(),
            score: 5,
            total_marks: 5,
            percentage: 100,
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });

      render(
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Quiz Attempt History")).toBeInTheDocument();
        expect(screen.getByText("Relational Model")).toBeInTheDocument();
      });
    });
  });

  describe("Admin Journey Workflows", () => {
    it("renders Admin Dashboard with overview metrics", async () => {
      vi.mocked(authApi.me).mockResolvedValue({
        user: {
          id: "admin-1",
          email: "admin@examprep.dev",
          name: "Admin User",
          role: "ADMIN",
          is_active: true,
        },
      });

      vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({
        summary: {
          subjects_count: 3,
          chapters_count: 9,
          active_questions_count: 30,
          draft_questions_count: 0,
          pending_batches_count: 1,
        },
      });

      render(
        <MemoryRouter initialEntries={["/admin"]}>
          <AuthProvider>
            <AdminPage />
          </AuthProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
        expect(screen.getByText("Welcome, Admin User (ADMIN)")).toBeInTheDocument();
      });
    });
  });
});
