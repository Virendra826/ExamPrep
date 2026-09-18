import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { AdminPage } from "../pages/AdminPage";
import { adminApi } from "../api/admin.api";
import { authApi } from "../api/auth.api";
import { subjectsApi } from "../api/subjects.api";
import { questionsApi } from "../api/questions.api";
import type { Role, User } from "../types/auth";
import type { AdminDashboardSummary } from "../types/admin";

vi.mock("../api/auth.api", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("../api/admin.api", () => ({
  adminApi: {
    getDashboardSummary: vi.fn(),
  },
}));

vi.mock("../api/subjects.api", () => ({
  subjectsApi: {
    getSubjects: vi.fn(),
    getSubject: vi.fn(),
  },
}));

vi.mock("../api/questions.api", () => ({
  questionsApi: {
    getQuestions: vi.fn(),
  },
}));

describe("Admin Dashboard Summary & Workflow (PROMPT 24)", () => {
  const mockAdminUser: User = {
    id: "admin-1",
    name: "Dev Administrator",
    email: "admin@examprep.dev",
    role: "ADMIN" as Role,
    is_active: true,
  };

  const mockSummary: AdminDashboardSummary = {
    subjects_count: 4,
    chapters_count: 12,
    active_questions_count: 45,
    draft_questions_count: 6,
    pending_batches_count: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({ user: mockAdminUser });
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValue({ summary: mockSummary });
    vi.mocked(subjectsApi.getSubjects).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });
    vi.mocked(questionsApi.getQuestions).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });
  });

  it("renders dashboard summary stat counts on admin home", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText(/Aggregating platform metrics.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Platform Inventory Overview")).toBeInTheDocument();
    });

    // Verify stats
    expect(screen.getByText("4")).toBeInTheDocument(); // Subjects
    expect(screen.getByText("12")).toBeInTheDocument(); // Chapters
    expect(screen.getByText("45")).toBeInTheDocument(); // Active Qs
    expect(screen.getByText("6")).toBeInTheDocument(); // Draft Qs
    expect(screen.getByText("2")).toBeInTheDocument(); // Pending Batches

    // Verify navigation action cards exist
    expect(screen.getByText("Curriculum & Subjects")).toBeInTheDocument();
    expect(screen.getByText("Question Bank Inventory")).toBeInTheDocument();
    expect(screen.getByText("PDF Batch Ingestion")).toBeInTheDocument();
  });

  it("navigates to Curriculum view when clicking Curriculum card and back to Overview", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Curriculum & Subjects")).toBeInTheDocument();
    });

    // Click Curriculum action card
    fireEvent.click(screen.getByText("Curriculum & Subjects"));

    await waitFor(() => {
      expect(screen.getByText(/New Subject/i)).toBeInTheDocument();
    });

    // Click Overview tab to navigate back
    const overviewTab = screen.getByRole("button", { name: /Overview/i });
    fireEvent.click(overviewTab);

    await waitFor(() => {
      expect(screen.getByText("Platform Inventory Overview")).toBeInTheDocument();
    });
  });

  it("navigates to Question Bank when clicking Question Bank card", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Question Bank Inventory")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Question Bank Inventory"));

    await waitFor(() => {
      expect(screen.getByText(/New Question/i)).toBeInTheDocument();
    });
  });

  it("navigates to PDF Ingestion when clicking PDF Pipeline card", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("PDF Batch Ingestion")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("PDF Batch Ingestion"));

    await waitFor(() => {
      expect(screen.getByText(/PDF Question Ingestion/i)).toBeInTheDocument();
    });
  });

  it("displays error banner and allows retry on fetch error", async () => {
    vi.mocked(adminApi.getDashboardSummary).mockRejectedValueOnce(
      new Error("Database connection timed out")
    );

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Database connection timed out/i)).toBeInTheDocument();
    });

    // Mock success on retry
    vi.mocked(adminApi.getDashboardSummary).mockResolvedValueOnce({ summary: mockSummary });

    fireEvent.click(screen.getByRole("button", { name: /Try Again/i }));

    await waitFor(() => {
      expect(screen.getByText("Platform Inventory Overview")).toBeInTheDocument();
    });
  });
});
