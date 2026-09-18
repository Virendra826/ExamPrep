import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QuizSolvePage } from "../features/quiz-solve/QuizSolvePage";
import { attemptsApi } from "../api/attempts.api";
import type { AttemptStateResponse } from "../types/attempts";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../api/attempts.api", () => ({
  attemptsApi: {
    getAttempt: vi.fn(),
    startAttempt: vi.fn(),
    saveAnswer: vi.fn(),
    submitAttempt: vi.fn(),
  },
}));

describe("Quiz Solving Interface (PROMPT 19)", () => {
  const mockAttemptData: AttemptStateResponse = {
    attempt: {
      id: "attempt-111",
      status: "CREATED",
      started_at: null,
      submitted_at: null,
      time_taken_seconds: null,
      created_at: new Date().toISOString(),
    },
    quiz: {
      id: "quiz-222",
      subject: { id: "subj-1", name: "Computer Networks" },
      chapter: { id: "chap-1", name: "Transport Layer" },
      question_type_filter: "BOTH",
      requested_count: 3,
      order_mode: "SEQUENTIAL",
      timer_mode: "VARIABLE",
    },
    questions: [
      {
        quiz_question_id: "qq-1",
        display_order: 1,
        question_id: "q-1",
        question_text: "What protocol operates at the transport layer?",
        options: [
          { id: "opt-1", text: "TCP" },
          { id: "opt-2", text: "IP" },
          { id: "opt-3", text: "Ethernet" },
          { id: "opt-4", text: "HTTP" },
        ],
        question_type: "CONCEPT",
        difficulty: "EASY",
      },
      {
        quiz_question_id: "qq-2",
        display_order: 2,
        question_id: "q-2",
        question_text: "Which TCP flag is used to initiate a connection?",
        options: ["SYN", "ACK", "FIN", "RST"],
        question_type: "PYQ",
        exam_name: "GATE",
        exam_year: 2020,
      },
      {
        quiz_question_id: "qq-3",
        display_order: 3,
        question_id: "q-3",
        question_text: "UDP is connection-oriented.",
        options: ["True", "False"],
        question_type: "CONCEPT",
      },
    ],
    submitted_answers: [
      {
        id: "sa-1",
        quiz_question_id: "qq-1",
        selected_option: "TCP",
        answered_at: new Date().toISOString(),
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (attemptsApi.getAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.parse(JSON.stringify(mockAttemptData))
    );
    (attemptsApi.startAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      attemptId: "attempt-111",
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
    });
    (attemptsApi.saveAnswer as ReturnType<typeof vi.fn>).mockResolvedValue({
      answer: {
        id: "sa-new",
        quiz_question_id: "qq-2",
        selected_option: "SYN",
        answered_at: new Date().toISOString(),
      },
    });
    (attemptsApi.submitAttempt as ReturnType<typeof vi.fn>).mockResolvedValue({
      attemptId: "attempt-111",
      status: "SUBMITTED",
      submitted_at: new Date().toISOString(),
      time_taken_seconds: 45,
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter initialEntries={["/attempts/attempt-111"]}>
        <Routes>
          <Route path="/attempts/:attemptId" element={<QuizSolvePage />} />
        </Routes>
      </MemoryRouter>
    );

  it("calls start on mount if CREATED, loads attempt state, and pre-fills existing answers", async () => {
    renderComponent();

    await waitFor(() => {
      expect(attemptsApi.getAttempt).toHaveBeenCalledWith("attempt-111");
      expect(attemptsApi.startAttempt).toHaveBeenCalledWith("attempt-111");
    });

    // Question 1 text rendered
    expect(
      screen.getByText("What protocol operates at the transport layer?")
    ).toBeInTheDocument();

    // Pre-filled answer "TCP" should be active/selected
    const tcpButton = screen.getByText("TCP").closest("button");
    expect(tcpButton).toHaveClass("border-indigo-500");
  });

  it("navigates between questions preserving selections in UI state", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument();
    });

    // Move to Question 2
    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Question 2 of 3/i)).toBeInTheDocument();
      expect(
        screen.getByText("Which TCP flag is used to initiate a connection?")
      ).toBeInTheDocument();
    });

    // Move back to Question 1
    const prevBtn = screen.getByRole("button", { name: /Previous/i });
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument();
      const tcpButton = screen.getByText("TCP").closest("button");
      expect(tcpButton).toHaveClass("border-indigo-500");
    });
  });

  it("auto-saves answer on option select without separate save button", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument();
    });

    // Navigate to Question 2
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Question 2 of 3/i)).toBeInTheDocument();
    });

    // Click "SYN" option
    const synOption = screen.getByText("SYN").closest("button");
    expect(synOption).not.toBeNull();
    fireEvent.click(synOption!);

    await waitFor(() => {
      expect(attemptsApi.saveAnswer).toHaveBeenCalledWith("attempt-111", "qq-2", "SYN");
    });
  });

  it("shows submit confirmation dialog with accurate answered/unanswered counts and submits", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument();
    });

    // Open submit dialog via Submit Quiz button in header
    const submitBtn = screen.getByRole("button", { name: /Submit Quiz/i });
    fireEvent.click(submitBtn);

    // Dialog opens
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    const modal = screen.getByRole("dialog");
    // 1 answered (TCP from initial seed), 2 unanswered
    expect(within(modal).getByText("3")).toBeInTheDocument(); // Total
    expect(within(modal).getByText("1")).toBeInTheDocument(); // Answered
    expect(within(modal).getAllByText("2").length).toBeGreaterThanOrEqual(1); // Unanswered
    expect(within(modal).getByText(/unanswered question\(s\)/i)).toBeInTheDocument();

    // Confirm submission
    const confirmBtn = within(modal).getByRole("button", { name: /Confirm & Submit/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(attemptsApi.submitAttempt).toHaveBeenCalledWith("attempt-111");
      expect(mockNavigate).toHaveBeenCalledWith("/attempts/attempt-111/results");
    });
  });

  it("shows locked state when quiz attempt has already been submitted", async () => {
    const submittedData = {
      ...mockAttemptData,
      attempt: {
        ...mockAttemptData.attempt,
        status: "SUBMITTED" as const,
      },
    };
    (attemptsApi.getAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(submittedData);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Quiz Already Submitted")).toBeInTheDocument();
      expect(
        screen.getByText(/This quiz attempt has already been submitted and answers are locked/i)
      ).toBeInTheDocument();
    });
  });
});
