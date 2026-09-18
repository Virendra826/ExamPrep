import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QuizResultPage } from "../pages/QuizResultPage";
import { resultsApi } from "../api/results.api";
import type { QuizResultResponse } from "../types/results";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../api/results.api", () => ({
  resultsApi: {
    getAttemptResult: vi.fn(),
  },
}));

describe("Quiz Result & Review UI (PROMPT 22)", () => {
  const mockResultData: QuizResultResponse = {
    attempt: {
      id: "attempt-123",
      status: "EVALUATED",
      started_at: "2026-01-01T10:00:00.000Z",
      submitted_at: "2026-01-01T10:02:30.000Z",
      time_taken_seconds: 150,
      created_at: "2026-01-01T10:00:00.000Z",
    },
    quiz: {
      id: "quiz-123",
      subject: { id: "subj-1", name: "Operating Systems" },
      chapter: { id: "chap-1", name: "Deadlocks" },
      question_type_filter: "BOTH",
      requested_count: 2,
    },
    result: {
      id: "res-123",
      attempt_id: "attempt-123",
      total_questions: 2,
      attempted_count: 2,
      correct_count: 1,
      incorrect_count: 1,
      unattempted_count: 0,
      marks_obtained: 1,
      total_marks: 2,
      percentage: 50,
      accuracy: 50,
      time_taken_seconds: 150,
      evaluated_at: "2026-01-01T10:02:30.000Z",
    },
    questions: [
      {
        quiz_question_id: "qq-1",
        display_order: 1,
        question_id: "q-1",
        question_text: "Which condition is NOT required for deadlock to occur?",
        options: [
          { id: "opt-1", text: "Mutual Exclusion" },
          { id: "opt-2", text: "Hold and Wait" },
          { id: "opt-3", text: "Preemption" },
          { id: "opt-4", text: "Circular Wait" },
        ],
        question_type: "CONCEPT",
        selected_option: "Preemption",
        correct_answer: "Preemption",
        is_correct: true,
        explanation: "Deadlock requires No Preemption. If preemption is allowed, deadlocks cannot persist.",
      },
      {
        quiz_question_id: "qq-2",
        display_order: 2,
        question_id: "q-2",
        question_text: "Banker algorithm is used for:",
        options: ["Deadlock Prevention", "Deadlock Avoidance", "Deadlock Detection", "Deadlock Recovery"],
        question_type: "PYQ",
        exam_name: "GATE",
        exam_year: 2019,
        selected_option: "Deadlock Prevention",
        correct_answer: "Deadlock Avoidance",
        is_correct: false,
        explanation: "Banker algorithm dynamically checks safe states to avoid deadlock.",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={["/attempts/attempt-123/results"]}>
        <Routes>
          <Route path="/attempts/:attemptId/results" element={<QuizResultPage />} />
        </Routes>
      </MemoryRouter>
    );

  it("renders performance report summary cards with score, percentage, and accuracy", async () => {
    (resultsApi.getAttemptResult as ReturnType<typeof vi.fn>).mockResolvedValue(mockResultData);

    renderComponent();

    // Verify header and subject
    await waitFor(() => {
      expect(screen.getByText("Quiz Performance Report")).toBeInTheDocument();
      expect(screen.getByText("Operating Systems")).toBeInTheDocument();
      expect(screen.getByText("Deadlocks")).toBeInTheDocument();
    });

    // Verify stats
    expect(screen.getByText("1 / 2 Marks")).toBeInTheDocument();
    expect(screen.getAllByText("50%").length).toBe(2); // Percentage and Accuracy
    expect(screen.getByText("02:30")).toBeInTheDocument(); // Duration formatted
  });

  it("renders question review items with correct answer indicators and explanations", async () => {
    (resultsApi.getAttemptResult as ReturnType<typeof vi.fn>).mockResolvedValue(mockResultData);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("Which condition is NOT required for deadlock to occur?")
      ).toBeInTheDocument();
    });

    // Question 1 has explanation
    expect(
      screen.getByText(/Deadlock requires No Preemption/i)
    ).toBeInTheDocument();

    // Question 2 has explanation
    expect(
      screen.getByText(/Banker algorithm dynamically checks safe states/i)
    ).toBeInTheDocument();

    // Badges
    expect(screen.getByText(/Correct \(\+1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Incorrect \(0\)/i)).toBeInTheDocument();
  });

  it("filters questions review list by Correct and Incorrect tabs", async () => {
    (resultsApi.getAttemptResult as ReturnType<typeof vi.fn>).mockResolvedValue(mockResultData);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("Which condition is NOT required for deadlock to occur?")
      ).toBeInTheDocument();
    });

    // Click "Correct (1)" filter tab
    const correctFilterTab = screen.getByRole("button", { name: /^Correct \(1\)/i });
    fireEvent.click(correctFilterTab);

    expect(
      screen.getByText("Which condition is NOT required for deadlock to occur?")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Banker algorithm is used for:")
    ).not.toBeInTheDocument();

    // Click "Incorrect (1)" filter tab
    const incorrectFilterTab = screen.getByRole("button", { name: /^Incorrect \(1\)/i });
    fireEvent.click(incorrectFilterTab);

    expect(
      screen.getByText("Banker algorithm is used for:")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Which condition is NOT required for deadlock to occur?")
    ).not.toBeInTheDocument();
  });

  it("displays error state when evaluation result fails to load", async () => {
    (resultsApi.getAttemptResult as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Attempt has not yet been evaluated")
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Evaluation Unavailable")).toBeInTheDocument();
      expect(screen.getByText("Attempt has not yet been evaluated")).toBeInTheDocument();
    });
  });
});
