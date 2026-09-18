import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HistoryPage } from "../pages/HistoryPage";
import { attemptsApi } from "../api/attempts.api";

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
    getHistory: vi.fn(),
  },
}));

describe("HistoryPage (PROMPT 23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when no attempts exist", async () => {
    vi.mocked(attemptsApi.getHistory).mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading history.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/No attempts yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/You haven't completed any quizzes yet/i)).toBeInTheDocument();
  });

  it("renders list of attempts with score and review link", async () => {
    vi.mocked(attemptsApi.getHistory).mockResolvedValue({
      data: [
        {
          id: "attempt-1",
          quiz_id: "quiz-1",
          status: "EVALUATED",
          started_at: "2026-01-01T10:00:00.000Z",
          submitted_at: "2026-01-01T10:05:00.000Z",
          score: 8,
          total_marks: 10,
          percentage: 80,
          accuracy: 80,
          time_taken_seconds: 300,
          created_at: "2026-01-01T10:00:00.000Z",
          quiz: {
            id: "quiz-1",
            timer_mode: "FIXED",
            question_type_filter: "BOTH",
            requested_count: 10,
            subject: { id: "sub-1", name: "Computer Networks" },
            chapter: { id: "chap-1", name: "OSI Model" },
          },
        },
      ],
      pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Computer Networks")).toBeInTheDocument();
    });

    expect(screen.getByText("OSI Model")).toBeInTheDocument();
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
    expect(screen.getByText("(80%)")).toBeInTheDocument();
    expect(screen.getByText("05:00")).toBeInTheDocument();

    const reviewBtn = screen.getByRole("button", { name: /Review/i });
    fireEvent.click(reviewBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/attempts/attempt-1/results");
  });
});
