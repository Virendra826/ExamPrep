import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { AdminPage } from "../pages/AdminPage";
import { authApi } from "../api/auth.api";
import { subjectsApi } from "../api/subjects.api";
import { chaptersApi } from "../api/chapters.api";
import type { Subject, Chapter } from "../types/curriculum";
import type { Role, User } from "../types/auth";

vi.mock("../api/auth.api", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock("../api/subjects.api", () => ({
  subjectsApi: {
    getSubjects: vi.fn(),
    getSubject: vi.fn(),
    createSubject: vi.fn(),
    updateSubject: vi.fn(),
    deactivateSubject: vi.fn(),
  },
}));

vi.mock("../api/chapters.api", () => ({
  chaptersApi: {
    getChaptersBySubject: vi.fn(),
    getChapter: vi.fn(),
    createChapter: vi.fn(),
    updateChapter: vi.fn(),
    deactivateChapter: vi.fn(),
  },
}));

describe("Admin Subject & Chapter Management UI (PROMPT 11)", () => {
  const mockAdminUser: User = {
    id: "admin-1",
    name: "Dev Administrator",
    email: "admin@examprep.dev",
    role: "ADMIN" as Role,
    is_active: true,
  };

  const mockSubjects: Subject[] = [
    {
      id: "subj-1",
      name: "Operating Systems",
      description: "Processes, threads, and memory",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chapter_count: 3,
    },
    {
      id: "subj-2",
      name: "Computer Networks",
      description: "OSI model and protocols",
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chapter_count: 1,
    },
  ];

  const mockChapters: Chapter[] = [
    {
      id: "chap-1",
      subject_id: "subj-1",
      name: "Process Synchronization",
      description: "Semaphores and mutexes",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      question_count: 10,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.me).mockResolvedValue({ user: mockAdminUser });
    vi.mocked(subjectsApi.getSubjects).mockResolvedValue({
      data: mockSubjects,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
    vi.mocked(chaptersApi.getChaptersBySubject).mockResolvedValue({
      data: mockChapters,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it("renders subject list with name, chapter count, and active/inactive badges", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?tab=curriculum"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Operating Systems")).toBeInTheDocument();
      expect(screen.getByText("Computer Networks")).toBeInTheDocument();
      expect(screen.getByText(/3 chapters/i)).toBeInTheDocument();
      expect(screen.getByText(/^Active$/i)).toBeInTheDocument();
      expect(screen.getByText(/^Inactive$/i)).toBeInTheDocument();
    });
  });

  it("shows create form validation errors on empty or invalid inputs", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?tab=curriculum"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/New Subject/i)).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByText(/New Subject/i));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Try submitting with empty name
    const submitBtn = screen.getByRole("button", { name: /Create Subject/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Subject name must be at least 2 characters long/i)).toBeInTheDocument();
      expect(subjectsApi.createSubject).not.toHaveBeenCalled();
    });
  });

  it("deactivate action triggers confirmation dialog before calling API", async () => {
    vi.mocked(subjectsApi.deactivateSubject).mockResolvedValue({
      message: "Subject deactivated successfully",
      subject: { ...mockSubjects[0], is_active: false },
    });

    render(
      <MemoryRouter initialEntries={["/admin?tab=curriculum"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Operating Systems/i)).toBeInTheDocument();
    });

    // Click deactivate icon button on the first active subject
    const deactivateBtns = screen.getAllByTitle(/Deactivate Subject/i);
    expect(deactivateBtns.length).toBeGreaterThan(0);
    fireEvent.click(deactivateBtns[0]);

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to deactivate "Operating Systems"/i)).toBeInTheDocument();
    });

    // API should not have been called yet
    expect(subjectsApi.deactivateSubject).not.toHaveBeenCalled();

    // Click Deactivate inside the confirm dialog
    const confirmBtn = screen.getByRole("button", { name: /^Deactivate$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(subjectsApi.deactivateSubject).toHaveBeenCalledWith("subj-1");
    });
  });

  it("navigates into nested chapters view when clicking a subject", async () => {
    render(
      <MemoryRouter initialEntries={["/admin?tab=curriculum"]}>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Operating Systems/i)).toBeInTheDocument();
    });

    // Click the subject to view chapters
    fireEvent.click(screen.getByText(/Operating Systems/i));

    await waitFor(() => {
      expect(screen.getByText(/Chapters in/i)).toBeInTheDocument();
      expect(screen.getByText(/Process Synchronization/i)).toBeInTheDocument();
      expect(screen.getByText(/10 questions/i)).toBeInTheDocument();
    });
  });
});
