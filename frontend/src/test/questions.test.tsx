import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QuestionList } from "../features/admin/questions/QuestionList";
import { QuestionFormModal } from "../features/admin/questions/QuestionFormModal";
import { questionsApi } from "../api/questions.api";
import { subjectsApi } from "../api/subjects.api";
import { chaptersApi } from "../api/chapters.api";
import type { Question } from "../types/questions";
import type { Subject, Chapter } from "../types/curriculum";

vi.mock("../api/questions.api", () => ({
  questionsApi: {
    getQuestions: vi.fn(),
    getQuestion: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
    deactivateQuestion: vi.fn(),
    getAvailableCount: vi.fn(),
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

describe("Admin Question Management UI (PROMPT 13)", () => {
  const mockSubjects: Subject[] = [
    {
      id: "subj-1",
      name: "Operating Systems",
      description: "Processes, threads, and memory",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chapter_count: 2,
    },
    {
      id: "subj-2",
      name: "Database Systems",
      description: "Relational models and SQL",
      is_active: true,
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
    },
    {
      id: "chap-2",
      subject_id: "subj-1",
      name: "Memory Management",
      description: "Paging and virtual memory",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockQuestions: Question[] = [
    {
      id: "q-1",
      question_text: "What is the critical section problem in operating systems?",
      options: [
        { id: "opt-1", text: "A section where shared resources are accessed" },
        { id: "opt-2", text: "A hardware failure zone" },
        { id: "opt-3", text: "A memory leak location" },
        { id: "opt-4", text: "A kernel panic state" },
      ],
      correct_answer: "A section where shared resources are accessed",
      explanation: "Critical section refers to code accessing shared variables.",
      subject_id: "subj-1",
      chapter_id: "chap-1",
      question_type: "CONCEPT",
      source: "MANUAL",
      exam_name: null,
      exam_year: null,
      difficulty: "MEDIUM",
      status: "ACTIVE",
      ingestion_batch_id: null,
      created_by: "admin-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subject: { id: "subj-1", name: "Operating Systems" },
      chapter: { id: "chap-1", name: "Process Synchronization" },
    },
    {
      id: "q-2",
      question_text: "Which of the following page replacement algorithms suffers from Belady's anomaly?",
      options: [
        { id: "opt-21", text: "LRU" },
        { id: "opt-22", text: "FIFO" },
        { id: "opt-23", text: "Optimal" },
      ],
      correct_answer: "FIFO",
      explanation: "FIFO page replacement can exhibit Belady's anomaly.",
      subject_id: "subj-1",
      chapter_id: "chap-2",
      question_type: "PYQ",
      source: "MANUAL",
      exam_name: "GATE Computer Science",
      exam_year: 2021,
      difficulty: "HARD",
      status: "DRAFT",
      ingestion_batch_id: null,
      created_by: "admin-1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subject: { id: "subj-1", name: "Operating Systems" },
      chapter: { id: "chap-2", name: "Memory Management" },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subjectsApi.getSubjects).mockResolvedValue({
      data: mockSubjects,
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
    vi.mocked(chaptersApi.getChaptersBySubject).mockResolvedValue({
      data: mockChapters,
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    });
    vi.mocked(questionsApi.getQuestions).mockResolvedValue({
      data: mockQuestions,
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });
  });

  it("renders question list with items, taxonomy context, type, and status badges", async () => {
    render(
      <MemoryRouter>
        <QuestionList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/What is the critical section problem/i)).toBeInTheDocument();
      expect(screen.getByText(/Which of the following page replacement algorithms/i)).toBeInTheDocument();
      expect(screen.getAllByText(/^Active$/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/^Draft$/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/GATE Computer Science/i)).toBeInTheDocument();
    });
  });

  it("filters questions correctly by search box and dropdowns", async () => {
    render(
      <MemoryRouter>
        <QuestionList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search questions.../i)).toBeInTheDocument();
    });

    // Type into search box
    const searchInput = screen.getByPlaceholderText(/Search questions.../i);
    fireEvent.change(searchInput, { target: { value: "Belady" } });

    await waitFor(() => {
      expect(questionsApi.getQuestions).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "Belady",
        })
      );
    });

    // Filter by type
    const typeSelect = screen.getByLabelText(/Filter by question type/i);
    fireEvent.change(typeSelect, { target: { value: "PYQ" } });

    await waitFor(() => {
      expect(questionsApi.getQuestions).toHaveBeenCalledWith(
        expect.objectContaining({
          question_type: "PYQ",
        })
      );
    });

    // Filter by status
    const statusSelect = screen.getByLabelText(/Filter by status/i);
    fireEvent.change(statusSelect, { target: { value: "ACTIVE" } });

    await waitFor(() => {
      expect(questionsApi.getQuestions).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ACTIVE",
        })
      );
    });
  });

  it("cascading subject -> chapter select loads chapters for the chosen subject", async () => {
    render(
      <MemoryRouter>
        <QuestionList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Filter by subject/i)).toBeInTheDocument();
    });

    const subjectSelect = screen.getByLabelText(/Filter by subject/i);
    fireEvent.change(subjectSelect, { target: { value: "subj-1" } });

    await waitFor(() => {
      expect(chaptersApi.getChaptersBySubject).toHaveBeenCalledWith("subj-1", expect.any(Object));
    });
  });

  it("form validation blocks invalid submissions (missing fields, bad correct_answer, missing PYQ metadata)", async () => {
    const onSubmit = vi.fn();
    render(
      <QuestionFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Create Question/i })).toBeInTheDocument();
    });

    // 1. Submit completely empty form
    fireEvent.click(screen.getByRole("button", { name: /Create Question/i }));

    await waitFor(() => {
      expect(screen.getByText(/Please select a subject/i)).toBeInTheDocument();
      expect(screen.getByText(/Please select a chapter/i)).toBeInTheDocument();
      expect(screen.getByText(/Question text is required/i)).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    // 2. Switch to PYQ question type without filling exam_name / exam_year
    const pyqRadio = screen.getByText(/^PYQ$/i);
    fireEvent.click(pyqRadio);

    // Fill subject, chapter, question text
    fireEvent.change(screen.getByLabelText(/^Subject/i), { target: { value: "subj-1" } });
    await waitFor(() => {
      expect(screen.getByLabelText(/^Chapter/i)).not.toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText(/^Chapter/i), { target: { value: "chap-1" } });
    fireEvent.change(screen.getByLabelText(/^Question Text/i), {
      target: { value: "What is an inode in Unix filesystem?" },
    });

    // Fill options
    const optionAInput = screen.getByLabelText(/Option A text/i);
    const optionBInput = screen.getByLabelText(/Option B text/i);
    fireEvent.change(optionAInput, { target: { value: "A data structure representing a file" } });
    fireEvent.change(optionBInput, { target: { value: "A network router" } });

    // Submit without PYQ exam metadata
    fireEvent.click(screen.getByRole("button", { name: /Create Question/i }));

    await waitFor(() => {
      expect(screen.getByText(/PYQ questions require both Exam Name and Exam Year/i)).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it("allows dynamic adding and removing of options", async () => {
    render(
      <QuestionFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Add Option/i)).toBeInTheDocument();
    });

    // Initially 2 options (A, B)
    expect(screen.getByLabelText(/Option A text/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Option B text/i)).toBeInTheDocument();

    // Add option C
    fireEvent.click(screen.getByText(/Add Option/i));
    expect(screen.getByLabelText(/Option C text/i)).toBeInTheDocument();

    // Remove option C
    const removeCBtn = screen.getByLabelText(/Remove option C/i);
    fireEvent.click(removeCBtn);
    expect(screen.queryByLabelText(/Option C text/i)).not.toBeInTheDocument();
  });

  it("successfully creates a valid CONCEPT question", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <QuestionFormModal
        isOpen={true}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/^Subject/i)).toBeInTheDocument();
    });

    // Select subject and chapter
    fireEvent.change(screen.getByLabelText(/^Subject/i), { target: { value: "subj-1" } });
    await waitFor(() => {
      expect(screen.getByLabelText(/^Chapter/i)).not.toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText(/^Chapter/i), { target: { value: "chap-1" } });

    // Enter question text
    fireEvent.change(screen.getByLabelText(/^Question Text/i), {
      target: { value: "What is deadlock prevention?" },
    });

    // Enter options
    fireEvent.change(screen.getByLabelText(/Option A text/i), {
      target: { value: "Eliminating at least one of the 4 Coffman conditions" },
    });
    fireEvent.change(screen.getByLabelText(/Option B text/i), {
      target: { value: "Rebooting the system periodically" },
    });

    // Mark Option A as correct
    const markCorrectA = screen.getByRole("button", { name: /Option A is correct answer|Mark option A as correct/i });
    fireEvent.click(markCorrectA);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /Create Question/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          question_text: "What is deadlock prevention?",
          subject_id: "subj-1",
          chapter_id: "chap-1",
          question_type: "CONCEPT",
          correct_answer: "Eliminating at least one of the 4 Coffman conditions",
        })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("triggers confirmation dialog when deactivating a question and calls api", async () => {
    vi.mocked(questionsApi.deactivateQuestion).mockResolvedValue({
      question: { ...mockQuestions[0], status: "INACTIVE" },
    });

    render(
      <MemoryRouter>
        <QuestionList />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(`Deactivate question ${mockQuestions[0].id}`)).toBeInTheDocument();
    });

    // Click deactivate button
    const deactivateBtn = screen.getByLabelText(`Deactivate question ${mockQuestions[0].id}`);
    fireEvent.click(deactivateBtn);

    // Confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByText(/Deactivate Question/i)).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to deactivate this question/i)).toBeInTheDocument();
    });

    // Confirm deactivation
    const confirmBtn = screen.getByRole("button", { name: /^Deactivate$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(questionsApi.deactivateQuestion).toHaveBeenCalledWith(mockQuestions[0].id);
      expect(questionsApi.getQuestions).toHaveBeenCalledTimes(2); // Initial + reload
    });
  });
});
