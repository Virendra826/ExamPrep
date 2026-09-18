import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QuizConfigForm } from "../features/quiz-config/QuizConfigForm";
import { subjectsApi } from "../api/subjects.api";
import { chaptersApi } from "../api/chapters.api";
import { questionsApi } from "../api/questions.api";
import { quizApi } from "../api/quiz.api";
import type { Subject, Chapter } from "../types/curriculum";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../api/subjects.api", () => ({
  subjectsApi: {
    getSubjects: vi.fn(),
  },
}));

vi.mock("../api/chapters.api", () => ({
  chaptersApi: {
    getChapters: vi.fn(),
    getChaptersBySubject: vi.fn(),
  },
}));

vi.mock("../api/questions.api", () => ({
  questionsApi: {
    getAvailableCount: vi.fn(),
  },
}));

vi.mock("../api/quiz.api", () => ({
  quizApi: {
    createQuiz: vi.fn(),
  },
}));

describe("Quiz Configuration UI (PROMPT 16)", () => {
  const mockSubjects: Subject[] = [
    {
      id: "00000001-0000-0000-0000-000000000001",
      name: "Computer Networks",
      description: "Networking basics",
      is_active: true,
      chapter_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "00000001-0000-0000-0000-000000000002",
      name: "Operating Systems",
      description: "OS concepts",
      is_active: true,
      chapter_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockCNChapters: Chapter[] = [
    {
      id: "00000002-0000-0000-0000-000000000001",
      subject_id: "00000001-0000-0000-0000-000000000001",
      name: "Physical Layer",
      description: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockOSChapters: Chapter[] = [
    {
      id: "00000002-0000-0000-0000-000000000002",
      subject_id: "00000001-0000-0000-0000-000000000002",
      name: "Memory Management",
      description: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (subjectsApi.getSubjects as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockSubjects,
      total: mockSubjects.length,
      page: 1,
      limit: 100,
    });
    (chaptersApi.getChapters as ReturnType<typeof vi.fn>).mockImplementation((subjectId: string) => {
      if (subjectId === "00000001-0000-0000-0000-000000000001") {
        return Promise.resolve({ data: mockCNChapters, total: 1, page: 1, limit: 100 });
      }
      return Promise.resolve({ data: mockOSChapters, total: 1, page: 1, limit: 100 });
    });
    (questionsApi.getAvailableCount as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 25 });
  });

  it("loads subjects and chapters on mount, updating chapter list when subject changes", async () => {
    render(
      <MemoryRouter>
        <QuizConfigForm />
      </MemoryRouter>
    );

    // Initial subject selected
    await waitFor(() => {
      expect(screen.getByText("Physical Layer")).toBeInTheDocument();
    });

    // Change subject to Operating Systems
    const subjectSelect = screen.getByRole("combobox", { name: /Subject/i });
    fireEvent.change(subjectSelect, {
      target: { value: "00000001-0000-0000-0000-000000000002" },
    });

    // Chapter list should update to Memory Management
    await waitFor(() => {
      expect(screen.getByText("Memory Management")).toBeInTheDocument();
    });
  });

  it("disables submit and displays inline warning when count exceeds available", async () => {
    (questionsApi.getAvailableCount as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 6 });

    render(
      <MemoryRouter>
        <QuizConfigForm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Only 6 questions available for this selection")).toBeInTheDocument();
    });

    // Preset 10 is selected by default, which is > 6
    const submitBtn = screen.getByRole("button", { name: /Generate Quiz/i });
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Requested count \(10\) exceeds available active questions/i)).toBeInTheDocument();
  });

  it("shows validation error and disables submit for invalid custom count or fixed timer duration", async () => {
    (questionsApi.getAvailableCount as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 100 });

    render(
      <MemoryRouter>
        <QuizConfigForm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("100 questions available")).toBeInTheDocument();
    });

    // Switch to Custom count
    const customCountBtn = screen.getByRole("button", { name: /Custom/i });
    fireEvent.click(customCountBtn);

    // Enter invalid count: 0
    const customInput = screen.getByLabelText(/Custom Count/i);
    fireEvent.change(customInput, { target: { value: "0" } });

    const submitBtn = screen.getByRole("button", { name: /Generate Quiz/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Question count must be at least 1/i)).toBeInTheDocument();
    });

    // Fix custom count to valid number
    fireEvent.change(customInput, { target: { value: "15" } });

    // Switch to Fixed timer mode
    const fixedTimerBtn = screen.getByRole("button", { name: /Fixed Duration/i });
    fireEvent.click(fixedTimerBtn);

    // Set timer minutes to 0
    const timerInput = screen.getByLabelText(/Quiz Duration \(Minutes\)/i);
    fireEvent.change(timerInput, { target: { value: "0" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Timer duration in minutes must be greater than 0/i)).toBeInTheDocument();
    });
    expect(quizApi.createQuiz).not.toHaveBeenCalled();
  });

  it("submits valid quiz configuration and navigates to attempt route", async () => {
    (questionsApi.getAvailableCount as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 30 });
    (quizApi.createQuiz as ReturnType<typeof vi.fn>).mockResolvedValue({
      quizId: "quiz-123",
      attemptId: "attempt-456",
    });

    render(
      <MemoryRouter>
        <QuizConfigForm />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("30 questions available")).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole("button", { name: /Generate Quiz/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(quizApi.createQuiz).toHaveBeenCalledWith(
        expect.objectContaining({
          subject_id: "00000001-0000-0000-0000-000000000001",
          requested_count: 10,
          order_mode: "RANDOM",
          timer_mode: "VARIABLE",
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/attempts/attempt-456");
    });
  });
});
