import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PdfUploadView } from "../features/admin/ingestion/PdfUploadView";
import { IngestionReviewView } from "../features/admin/ingestion/IngestionReviewView";
import { suggestChapterName } from "../utils/filenameSuggestion";
import { ingestionApi } from "../api/ingestion.api";
import { subjectsApi } from "../api/subjects.api";
import { chaptersApi } from "../api/chapters.api";
import type { IngestionBatch, CandidateQuestion } from "../types/ingestion";
import type { Subject, Chapter } from "../types/curriculum";

vi.mock("../api/ingestion.api", () => ({
  ingestionApi: {
    uploadPdf: vi.fn(),
    getBatch: vi.fn(),
    submitQuestions: vi.fn(),
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

describe("Admin PDF Ingestion UI (PROMPT 15 & PROMPT 27)", () => {
  const mockSubjects: Subject[] = [
    {
      id: "subj-1",
      name: "Computer Architecture",
      description: "CPUs, pipelines, and cache",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      chapter_count: 2,
    },
  ];

  const mockChapters: Chapter[] = [
    {
      id: "chap-1",
      subject_id: "subj-1",
      name: "Pipelining & Hazards",
      description: "Structural and data hazards",
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const mockBatch: IngestionBatch = {
    id: "batch-101",
    uploaded_by: "admin-1",
    source_type: "PDF",
    original_filename: "Work_Power_Energy_-_JEE_Main_2026__Jan__-_MathonGo.pdf",
    status: "EXTRACTED",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockCandidates: CandidateQuestion[] = [
    {
      id: "cand-1",
      question_text: "What type of hazard occurs when instructions read an operand before it is written?",
      options: [
        { text: "RAW (Read After Write)" },
        { text: "WAR (Write After Read)" },
        { text: "WAW (Write After Write)" },
      ],
      correct_answer: "RAW (Read After Write)",
      explanation: "RAW hazard is a true data dependency.",
      question_type: "CONCEPT",
      needsReview: false,
    },
    {
      id: "cand-2",
      question_text: "Consider a 5-stage pipeline with clock frequency 1GHz. [GATE 2021]",
      options: [
        { text: "1.2 ns" },
        { text: "2.5 ns" },
      ],
      correct_answer: "", // Missing answer -> needs review
      explanation: null,
      question_type: "PYQ",
      exam_name: "GATE",
      exam_year: 2021,
      needsReview: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(subjectsApi.getSubjects).mockResolvedValue({
      data: mockSubjects,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(chaptersApi.getChaptersBySubject).mockResolvedValue({
      data: mockChapters,
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });

  it("renders upload dropzone and rejects non-PDF file with client-side validation error", async () => {
    render(
      <MemoryRouter>
        <PdfUploadView onNavigateToQuestions={vi.fn()} />
      </MemoryRouter>
    );

    expect(screen.getByText(/PDF Question Ingestion/i)).toBeInTheDocument();
    expect(screen.getByText(/Select or drag & drop PDF here/i)).toBeInTheDocument();

    // Select a text file instead of PDF
    const fileInput = screen.getByTestId("pdf-file-input");
    const fakeTextFile = new File(["not a pdf"], "notes.txt", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [fakeTextFile] } });

    await waitFor(() => {
      expect(screen.getByText(/only PDF documents \(\.pdf\) are supported/i)).toBeInTheDocument();
    });
  });

  it("renders failed-extraction error state clearly when backend extraction fails", async () => {
    vi.mocked(ingestionApi.uploadPdf).mockResolvedValue({
      batch: {
        ...mockBatch,
        status: "FAILED",
        error_message: "This PDF appears to be empty or scanned-image only.",
      },
      candidates: [],
    });

    render(
      <MemoryRouter>
        <PdfUploadView onNavigateToQuestions={vi.fn()} />
      </MemoryRouter>
    );

    // Select valid PDF file
    const fileInput = screen.getByTestId("pdf-file-input");
    const validPdfFile = new File(["%PDF-1.4 dummy"], "scanned_empty.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(fileInput, { target: { files: [validPdfFile] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload & Extract/i)).toBeInTheDocument();
    });

    // Click upload
    fireEvent.click(screen.getByText(/Upload & Extract/i));

    await waitFor(() => {
      expect(screen.getByText(/PDF Extraction Failed/i)).toBeInTheDocument();
      expect(
        screen.getByText(/This PDF appears to be empty or scanned-image only/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/Try Another PDF/i)).toBeInTheDocument();
    });
  });

  it("review list renders extracted candidates and highlights candidates with needsReview", async () => {
    render(
      <MemoryRouter>
        <IngestionReviewView
          batch={mockBatch}
          initialCandidates={mockCandidates}
          onFinishReview={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/What type of hazard occurs/i)).toBeInTheDocument();
      expect(screen.getByText(/Consider a 5-stage pipeline/i)).toBeInTheDocument();
    });

    // Verify candidate 2 is highlighted with "Needs Review" badge
    const needsReviewBadge = screen.getByText(/Needs Review/i);
    expect(needsReviewBadge).toBeInTheDocument();
  });

  it("allows discarding an individual candidate question", async () => {
    render(
      <MemoryRouter>
        <IngestionReviewView
          batch={mockBatch}
          initialCandidates={mockCandidates}
          onFinishReview={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Consider a 5-stage pipeline/i)).toBeInTheDocument();
    });

    // Discard candidate #2
    const discardBtn = screen.getByLabelText(/Discard candidate 2/i);
    fireEvent.click(discardBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Consider a 5-stage pipeline/i)).not.toBeInTheDocument();
      expect(screen.getByText(/1 discarded/i)).toBeInTheDocument();
    });
  });

  it("applies bulk taxonomy assignment to all candidates", async () => {
    render(
      <MemoryRouter>
        <IngestionReviewView
          batch={mockBatch}
          initialCandidates={mockCandidates}
          onFinishReview={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Bulk assign subject/i)).toBeInTheDocument();
    });

    // Select subject in bulk toolbar
    fireEvent.change(screen.getByLabelText(/Bulk assign subject/i), {
      target: { value: "subj-1" },
    });

    await waitFor(() => {
      expect(chaptersApi.getChaptersBySubject).toHaveBeenCalledWith("subj-1", expect.any(Object));
      expect(screen.getByLabelText(/Bulk assign chapter/i)).not.toBeDisabled();
    });

    // Select chapter in bulk toolbar
    fireEvent.change(screen.getByLabelText(/Bulk assign chapter/i), {
      target: { value: "chap-1" },
    });

    // Click Apply to All button
    fireEvent.click(screen.getByRole("button", { name: /Apply to All Candidates/i }));

    // Verify candidate card 1 now has subject-1 and chapter-1 selected
    expect(screen.getByLabelText(/Subject for candidate 1/i)).toHaveValue("subj-1");
    expect(screen.getByLabelText(/Chapter for candidate 1/i)).toHaveValue("chap-1");
  });

  it("submits reviewed questions successfully and shows completion summary", async () => {
    vi.mocked(ingestionApi.submitQuestions).mockResolvedValue({
      batch: { ...mockBatch, status: "REVIEWED" },
      createdCount: 1,
      questions: [],
    });

    // Provide 1 candidate with answer filled
    const readyCandidates: CandidateQuestion[] = [
      {
        ...mockCandidates[0],
        subject_id: "subj-1",
        chapter_id: "chap-1",
      },
    ];

    render(
      <MemoryRouter>
        <IngestionReviewView
          batch={mockBatch}
          initialCandidates={readyCandidates}
          onFinishReview={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Commit 1 Questions/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Commit 1 Questions/i));

    await waitFor(() => {
      expect(ingestionApi.submitQuestions).toHaveBeenCalledWith("batch-101", expect.any(Array));
      expect(screen.getByText(/Batch Review Completed!/i)).toBeInTheDocument();
      expect(screen.getByText(/Successfully saved/i)).toBeInTheDocument();
    });
  });

  describe("Inline Subject/Chapter Creation (PROMPT 27)", () => {
    it("suggestChapterName correctly extracts clean chapter name from filename", () => {
      expect(
        suggestChapterName("Work_Power_Energy_-_JEE_Main_2026__Jan__-_MathonGo.pdf")
      ).toBe("Work Power Energy");
      expect(suggestChapterName("Rotational_Motion_JEE_2024.pdf")).toBe("Rotational Motion");
      expect(suggestChapterName("Thermodynamics_Question_Bank.pdf")).toBe("Thermodynamics");
      expect(suggestChapterName("")).toBe("");
    });

    it("allows creating a new subject inline and immediately selects it without a page reload", async () => {
      const newSubject: Subject = {
        id: "subj-new-1",
        name: "Physics Mechanics",
        description: "Classical mechanics and dynamics",
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        chapter_count: 0,
      };

      vi.mocked(subjectsApi.createSubject).mockResolvedValue({ subject: newSubject });

      render(
        <MemoryRouter>
          <IngestionReviewView
            batch={mockBatch}
            initialCandidates={mockCandidates}
            onFinishReview={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Bulk assign subject/i)).toBeInTheDocument();
      });

      // Select "+ Create new subject" option from bulk subject dropdown
      fireEvent.change(screen.getByLabelText(/Bulk assign subject/i), {
        target: { value: "__create_new__" },
      });

      // Modal should open
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Create New Subject/i })).toBeInTheDocument();
      });

      // Fill in subject name
      const nameInput = screen.getByTestId("inline-taxonomy-name-input");
      fireEvent.change(nameInput, { target: { value: "Physics Mechanics" } });

      // Submit modal form
      fireEvent.click(screen.getByRole("button", { name: /Create Subject/i }));

      await waitFor(() => {
        expect(subjectsApi.createSubject).toHaveBeenCalledWith({
          name: "Physics Mechanics",
          description: undefined,
        });
        // Modal should close
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      // Bulk assign subject dropdown should now have the new subject selected
      expect(screen.getByLabelText(/Bulk assign subject/i)).toHaveValue("subj-new-1");
    });

    it("allows creating a new chapter inline with pre-filled filename suggestion", async () => {
      const newChapter: Chapter = {
        id: "chap-new-1",
        subject_id: "subj-1",
        name: "Work Power Energy",
        description: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(chaptersApi.createChapter).mockResolvedValue({ chapter: newChapter });

      render(
        <MemoryRouter>
          <IngestionReviewView
            batch={mockBatch}
            initialCandidates={mockCandidates}
            onFinishReview={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Bulk assign subject/i)).toBeInTheDocument();
      });

      // First select subject
      fireEvent.change(screen.getByLabelText(/Bulk assign subject/i), {
        target: { value: "subj-1" },
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/Bulk assign chapter/i)).not.toBeDisabled();
      });

      // Select "+ Create new chapter" from bulk chapter dropdown
      fireEvent.change(screen.getByLabelText(/Bulk assign chapter/i), {
        target: { value: "__create_new__" },
      });

      // Modal should open with suggested name from mockBatch filename
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Create New Chapter/i })).toBeInTheDocument();
        const input = screen.getByTestId("inline-taxonomy-name-input") as HTMLInputElement;
        expect(input.value).toBe("Work Power Energy");
      });

      // Submit chapter form
      fireEvent.click(screen.getByRole("button", { name: /Create Chapter/i }));

      await waitFor(() => {
        expect(chaptersApi.createChapter).toHaveBeenCalledWith({
          subject_id: "subj-1",
          name: "Work Power Energy",
          description: undefined,
        });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      // Bulk chapter dropdown should now have the new chapter selected
      expect(screen.getByLabelText(/Bulk assign chapter/i)).toHaveValue("chap-new-1");
    });

    it("handles duplicate-name 409 conflict gracefully with an inline error message", async () => {
      vi.mocked(subjectsApi.createSubject).mockRejectedValue(
        new Error("A subject with name 'Computer Architecture' already exists")
      );

      render(
        <MemoryRouter>
          <IngestionReviewView
            batch={mockBatch}
            initialCandidates={mockCandidates}
            onFinishReview={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Bulk assign subject/i)).toBeInTheDocument();
      });

      // Open create subject modal
      fireEvent.change(screen.getByLabelText(/Bulk assign subject/i), {
        target: { value: "__create_new__" },
      });

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const nameInput = screen.getByTestId("inline-taxonomy-name-input");
      fireEvent.change(nameInput, { target: { value: "Computer Architecture" } });

      fireEvent.click(screen.getByRole("button", { name: /Create Subject/i }));

      // Inline error should appear, modal stays open without crashing
      await waitFor(() => {
        expect(
          screen.getByText(/A subject with name 'Computer Architecture' already exists/i)
        ).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // User can cancel modal safely
      fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("allows inline subject creation directly from an individual candidate card", async () => {
      const newSubject: Subject = {
        id: "subj-cand-1",
        name: "Operating Systems",
        description: null,
        chapter_count: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.mocked(subjectsApi.createSubject).mockResolvedValue({ subject: newSubject });

      render(
        <MemoryRouter>
          <IngestionReviewView
            batch={mockBatch}
            initialCandidates={mockCandidates}
            onFinishReview={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Subject for candidate 1/i)).toBeInTheDocument();
      });

      // Select create new subject from candidate 1 dropdown
      fireEvent.change(screen.getByLabelText(/Subject for candidate 1/i), {
        target: { value: "__create_new__" },
      });

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId("inline-taxonomy-name-input"), {
        target: { value: "Operating Systems" },
      });
      fireEvent.click(screen.getByRole("button", { name: /Create Subject/i }));

      await waitFor(() => {
        expect(subjectsApi.createSubject).toHaveBeenCalledWith({
          name: "Operating Systems",
          description: undefined,
        });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });

      // Candidate 1 subject dropdown should now be updated to the new subject
      expect(screen.getByLabelText(/Subject for candidate 1/i)).toHaveValue("subj-cand-1");
    });
  });

  describe("Tiered Confidence Badges, Provenance & Diagram Rendering (PROMPT 8)", () => {
    it("renders green Ready badge for confidence: HIGH candidate", async () => {
      const highConfidenceCandidates: CandidateQuestion[] = [
        {
          id: "cand-high",
          question_text: "Clean question text",
          options: [{ text: "A" }, { text: "B" }],
          correct_answer: "A",
          question_type: "CONCEPT",
          needsReview: false,
          confidence: "HIGH",
          sourcePages: [2],
          extractionMethod: "TEXT",
        },
      ];

      render(
        <MemoryRouter>
          <IngestionReviewView
            batch={mockBatch}
            initialCandidates={highConfidenceCandidates}
            onFinishReview={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Ready")).toBeInTheDocument();
        expect(screen.getByText("p. 2")).toBeInTheDocument();
      });
    });

    it("renders red Needs Review badge, reason text, and multi-page range for confidence: LOW with reviewReason", async () => {
      const lowConfidenceCandidates: CandidateQuestion[] = [
        {
          id: "cand-low",
          question_text: "Messy OCR question text",
          options: [{ text: "A" }, { text: "B" }],
          correct_answer: "A",
          question_type: "CONCEPT",
          needsReview: true,
          confidence: "LOW",
          reviewReason: "Vision escalation failed; possible diagram or layout artifact",
          sourcePages: [3, 4],
          diagram_url: "http://localhost:5000/uploads/test-diagram.png",
        },
      ];

      render(
        <MemoryRouter>
          <IngestionReviewView
            batch={mockBatch}
            initialCandidates={lowConfidenceCandidates}
            onFinishReview={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Needs Review")).toBeInTheDocument();
        expect(
          screen.getByText("Vision escalation failed; possible diagram or layout artifact")
        ).toBeInTheDocument();
        expect(screen.getByText("pp. 3–4")).toBeInTheDocument();
      });

      // Confirm diagram image rendered with diagram_url
      const img = screen.getByRole("img", { name: /Associated Figure/i });
      expect(img).toHaveAttribute("src", "http://localhost:5000/uploads/test-diagram.png");
    });

    it("falls back gracefully to boolean needsReview when confidence is undefined (pre-upgrade data)", async () => {
      const legacyCandidates: CandidateQuestion[] = [
        {
          id: "cand-legacy-clean",
          question_text: "Legacy clean question",
          options: [{ text: "A" }, { text: "B" }],
          correct_answer: "A",
          question_type: "CONCEPT",
          needsReview: false,
        },
        {
          id: "cand-legacy-unresolved",
          question_text: "Legacy unresolved question",
          options: [{ text: "A" }, { text: "B" }],
          correct_answer: "",
          question_type: "CONCEPT",
          needsReview: true,
        },
      ];

      render(
        <MemoryRouter>
          <IngestionReviewView
            batch={mockBatch}
            initialCandidates={legacyCandidates}
            onFinishReview={vi.fn()}
          />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Legacy clean question")).toBeInTheDocument();
        expect(screen.getByText("Legacy unresolved question")).toBeInTheDocument();
      });

      expect(screen.getByText("Ready")).toBeInTheDocument();
      expect(screen.getByText("Needs Review")).toBeInTheDocument();
    });
  });
});

