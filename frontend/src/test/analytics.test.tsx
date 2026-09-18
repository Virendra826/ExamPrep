import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { analyticsApi } from "../api/analytics.api";
import type { AnalyticsSummary, ChapterPerformance } from "../types/analytics";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../api/analytics.api", () => ({
  analyticsApi: {
    getSummary: vi.fn(),
    getChapterPerformance: vi.fn(),
  },
}));

describe("AnalyticsPage (PROMPT 23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state cleanly when user has zero attempts", async () => {
    vi.mocked(analyticsApi.getSummary).mockResolvedValue({
      summary: {
        total_attempts: 0,
        best_score: 0,
        average_percentage: 0,
        average_accuracy: 0,
        average_time_per_question: 0,
      },
    });
    vi.mocked(analyticsApi.getChapterPerformance).mockResolvedValue({
      chapters: [],
    });

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Computing analytics summary.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/No analytics data yet/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Complete your first evaluated quiz to generate insights/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Your First Quiz/i })
    ).toBeInTheDocument();
  });

  it("renders summary statistics and chapter breakdown when user has data", async () => {
    const mockSummary: AnalyticsSummary = {
      total_attempts: 5,
      best_score: 10,
      average_percentage: 75.5,
      average_accuracy: 80.2,
      average_time_per_question: 42,
    };

    const mockChapters: ChapterPerformance[] = [
      {
        chapter_id: "chap-os-1",
        chapter_name: "Deadlocks & Semaphores",
        subject_name: "Operating Systems",
        attempt_count: 3,
        average_percentage: 83.3,
        average_accuracy: 85.0,
      },
      {
        chapter_id: "chap-db-1",
        chapter_name: "Transactions & ACID",
        subject_name: "Databases",
        attempt_count: 2,
        average_percentage: 64.0,
        average_accuracy: 72.5,
      },
    ];

    vi.mocked(analyticsApi.getSummary).mockResolvedValue({ summary: mockSummary });
    vi.mocked(analyticsApi.getChapterPerformance).mockResolvedValue({ chapters: mockChapters });

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
    });

    // Check summary cards
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("75.5%")).toBeInTheDocument();
    expect(screen.getByText("80.2%")).toBeInTheDocument();
    expect(screen.getByText("42s")).toBeInTheDocument();

    // Check chapter table
    expect(screen.getByText("Deadlocks & Semaphores")).toBeInTheDocument();
    expect(screen.getByText("Transactions & ACID")).toBeInTheDocument();
    expect(screen.getByText("83.3%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
    expect(screen.getByText("72.5%")).toBeInTheDocument();
  });

  it("handles and displays API error gracefully", async () => {
    vi.mocked(analyticsApi.getSummary).mockRejectedValue(new Error("Network connection error"));
    vi.mocked(analyticsApi.getChapterPerformance).mockResolvedValue({ chapters: [] });

    render(
      <MemoryRouter>
        <AnalyticsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Network connection error/i)).toBeInTheDocument();
    });
  });
});
