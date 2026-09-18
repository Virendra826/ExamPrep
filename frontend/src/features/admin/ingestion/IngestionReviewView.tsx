import React, { useState, useEffect, useCallback } from "react";
import { ingestionApi } from "../../../api/ingestion.api";
import { subjectsApi } from "../../../api/subjects.api";
import { chaptersApi } from "../../../api/chapters.api";
import { CandidateReviewCard } from "./CandidateReviewCard";
import { InlineTaxonomyModal } from "./InlineTaxonomyModal";
import { suggestChapterName } from "../../../utils/filenameSuggestion";
import type { IngestionBatch, CandidateQuestion } from "../../../types/ingestion";
import type { Subject, Chapter } from "../../../types/curriculum";
import {
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Layers,
  Send,
  Loader2,
  FileText,
  Plus,
} from "lucide-react";

interface IngestionReviewViewProps {
  batch: IngestionBatch;
  initialCandidates: CandidateQuestion[];
  onFinishReview: () => void;
}

export const IngestionReviewView: React.FC<IngestionReviewViewProps> = ({
  batch,
  initialCandidates,
  onFinishReview,
}) => {
  const [candidates, setCandidates] = useState<CandidateQuestion[]>(initialCandidates);
  const [discardedCount, setDiscardedCount] = useState(0);

  // Subjects and chapters lookup
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<string, Chapter[]>>({});

  // Bulk assignment controls
  const [bulkSubjectId, setBulkSubjectId] = useState("");
  const [bulkChapterId, setBulkChapterId] = useState("");

  // Submitting & status states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<{
    createdCount: number;
    discardedCount: number;
  } | null>(null);

  // Inline taxonomy creation modal state
  const [creationModal, setCreationModal] = useState<{
    isOpen: boolean;
    type: "SUBJECT" | "CHAPTER";
    targetContext: "bulk" | { candidateId: string };
    subjectId?: string;
    subjectName?: string;
    suggestedName?: string;
  } | null>(null);

  // Load subjects on mount
  useEffect(() => {
    let isMounted = true;
    const loadSubjects = async () => {
      try {
        const res = await subjectsApi.getSubjects({ limit: 100, includeInactive: false });
        if (isMounted) setSubjects(res.data);
      } catch (err) {
        console.error("Failed to load subjects:", err);
      }
    };
    void loadSubjects();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch chapters for a subject on demand
  const handleLoadChapters = useCallback(
    async (subjectId: string) => {
      if (chaptersBySubject[subjectId]) return;
      try {
        const res = await chaptersApi.getChaptersBySubject(subjectId, {
          limit: 100,
          includeInactive: false,
        });
        setChaptersBySubject((prev) => ({ ...prev, [subjectId]: res.data }));
      } catch (err) {
        console.error("Failed to load chapters for subject:", err);
      }
    },
    [chaptersBySubject]
  );

  // Bulk assign subject change
  const handleBulkSubjectChange = async (subjId: string) => {
    if (subjId === "__create_new__") {
      openCreateSubjectModal("bulk");
      return;
    }
    setBulkSubjectId(subjId);
    setBulkChapterId("");
    if (subjId) {
      await handleLoadChapters(subjId);
    }
  };

  const handleBulkChapterChange = (chapId: string) => {
    if (chapId === "__create_new__") {
      if (!bulkSubjectId) return;
      openCreateChapterModal("bulk", bulkSubjectId);
      return;
    }
    setBulkChapterId(chapId);
  };

  const handleApplyBulkAssignment = () => {
    if (!bulkSubjectId) return;
    setCandidates((prev) =>
      prev.map((c) => ({
        ...c,
        subject_id: bulkSubjectId,
        chapter_id: bulkChapterId || c.chapter_id,
      }))
    );
  };

  // Open inline creation modal for subjects
  const openCreateSubjectModal = (targetContext: "bulk" | { candidateId: string }) => {
    setCreationModal({
      isOpen: true,
      type: "SUBJECT",
      targetContext,
    });
  };

  // Open inline creation modal for chapters
  const openCreateChapterModal = (
    targetContext: "bulk" | { candidateId: string },
    subjectId: string
  ) => {
    const subject = subjects.find((s) => s.id === subjectId);
    const suggested = suggestChapterName(batch.original_filename);
    setCreationModal({
      isOpen: true,
      type: "CHAPTER",
      targetContext,
      subjectId,
      subjectName: subject?.name,
      suggestedName: suggested,
    });
  };

  // Handle successful inline creation of subject or chapter
  const handleTaxonomyCreated = ({
    type,
    subject,
    chapter,
  }: {
    type: "SUBJECT" | "CHAPTER";
    subject?: Subject;
    chapter?: Chapter;
  }) => {
    if (!creationModal) return;

    if (type === "SUBJECT" && subject) {
      // 1. Add new subject to subjects list
      setSubjects((prev) => [...prev, subject]);

      // 2. Initialize empty chapters array for new subject
      setChaptersBySubject((prev) => ({
        ...prev,
        [subject.id]: [],
      }));

      // 3. Immediately select new subject in originating dropdown
      if (creationModal.targetContext === "bulk") {
        setBulkSubjectId(subject.id);
        setBulkChapterId("");
      } else {
        const candidateId = creationModal.targetContext.candidateId;
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidateId ? { ...c, subject_id: subject.id, chapter_id: "" } : c))
        );
      }
    } else if (type === "CHAPTER" && chapter) {
      // 1. Add new chapter to chaptersBySubject lookup
      const subjId = chapter.subject_id;
      setChaptersBySubject((prev) => ({
        ...prev,
        [subjId]: [...(prev[subjId] || []).filter((c) => c.id !== chapter.id), chapter],
      }));

      // 2. Immediately select new chapter in originating dropdown
      if (creationModal.targetContext === "bulk") {
        setBulkChapterId(chapter.id);
      } else {
        const candidateId = creationModal.targetContext.candidateId;
        setCandidates((prev) =>
          prev.map((c) => (c.id === candidateId ? { ...c, chapter_id: chapter.id } : c))
        );
      }
    }
  };

  // Update a specific candidate
  const handleUpdateCandidate = (updated: CandidateQuestion) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  // Discard a candidate
  const handleDiscardCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setDiscardedCount((count) => count + 1);
  };

  // Validate and submit batch to backend
  const handleSubmitBatch = async () => {
    setValidationError(null);

    if (candidates.length === 0) {
      setValidationError("No candidate questions left to submit. All questions have been discarded.");
      return;
    }

    // Client-side completeness check
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c.subject_id) {
        setValidationError(`Candidate #${i + 1} is missing a Subject assignment.`);
        return;
      }
      if (!c.chapter_id) {
        setValidationError(`Candidate #${i + 1} is missing a Chapter assignment.`);
        return;
      }
      if (!c.question_text || c.question_text.trim().length === 0) {
        setValidationError(`Candidate #${i + 1} Question Text is empty.`);
        return;
      }
      if (!c.options || c.options.length < 2) {
        setValidationError(`Candidate #${i + 1} must have at least 2 options.`);
        return;
      }
      if (!c.correct_answer || !c.options.some((o) => o.text === c.correct_answer)) {
        setValidationError(`Candidate #${i + 1} correct answer must match one of its options.`);
        return;
      }
      if (c.question_type === "PYQ" && (!c.exam_name || !c.exam_year)) {
        setValidationError(`Candidate #${i + 1} is marked as PYQ but lacks Exam Name or Year.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await ingestionApi.submitQuestions(batch.id, candidates);
      setSuccessSummary({
        createdCount: res.createdCount,
        discardedCount,
      });
    } catch (err: any) {
      setValidationError(err?.message || "Failed to submit questions batch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success summary view
  if (successSummary) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-xl mx-auto shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white">Batch Review Completed!</h3>
        <p className="text-slate-300 text-sm">
          Successfully saved{" "}
          <strong className="text-emerald-400">{successSummary.createdCount} questions</strong> to
          the Question Bank ({successSummary.discardedCount} discarded).
        </p>
        <div className="pt-4">
          <button
            type="button"
            onClick={onFinishReview}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all inline-flex items-center space-x-2"
          >
            <span>Go to Question Bank</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const bulkChapters = bulkSubjectId ? chaptersBySubject[bulkSubjectId] || [] : [];

  return (
    <div className="space-y-6">
      {/* Batch Overview Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-indigo-400">
            <FileText className="w-4 h-4" />
            <span>Extracted from: {batch.original_filename}</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Review Candidate Questions</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {candidates.length} candidates awaiting review ({discardedCount} discarded). Assign
            taxonomy and ensure accuracy before committing to the bank.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmitBatch}
          disabled={isSubmitting || candidates.length === 0}
          className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition-all self-start md:self-auto disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>Commit {candidates.length} Questions</span>
        </button>
      </div>

      {/* Bulk Taxonomy Assignment Toolbar */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Quick Bulk Taxonomy Assignment (Apply to all candidates)</span>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-[11px]">
            <button
              type="button"
              onClick={() => openCreateSubjectModal("bulk")}
              className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-1"
            >
              <Plus className="w-3 h-3" />
              <span>+ New Subject</span>
            </button>
            {bulkSubjectId && (
              <>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => openCreateChapterModal("bulk", bulkSubjectId)}
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ New Chapter</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            aria-label="Bulk assign subject"
            value={bulkSubjectId}
            onChange={(e) => void handleBulkSubjectChange(e.target.value)}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select Subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__create_new__">+ Create new subject</option>
          </select>

          <select
            aria-label="Bulk assign chapter"
            value={bulkChapterId}
            onChange={(e) => handleBulkChapterChange(e.target.value)}
            disabled={!bulkSubjectId}
            className="px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          >
            <option value="">
              {!bulkSubjectId ? "Select subject first" : "Select Chapter (optional)..."}
            </option>
            {bulkChapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {bulkSubjectId && (
              <option value="__create_new__">+ Create new chapter</option>
            )}
          </select>

          <button
            type="button"
            onClick={handleApplyBulkAssignment}
            disabled={!bulkSubjectId}
            className="px-4 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            Apply to All Candidates
          </button>
        </div>
      </div>

      {/* Validation Error Alert */}
      {validationError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Candidate List Cards */}
      <div className="space-y-4">
        {candidates.map((candidate, idx) => (
          <CandidateReviewCard
            key={candidate.id}
            candidate={candidate}
            index={idx}
            subjects={subjects}
            chaptersBySubject={chaptersBySubject}
            onLoadChapters={handleLoadChapters}
            onUpdate={handleUpdateCandidate}
            onDiscard={handleDiscardCandidate}
            onCreateSubject={(candId) => openCreateSubjectModal({ candidateId: candId })}
            onCreateChapter={(candId, subjId) => openCreateChapterModal({ candidateId: candId }, subjId)}
          />
        ))}
      </div>

      {/* Inline Subject/Chapter Creation Modal */}
      {creationModal && (
        <InlineTaxonomyModal
          isOpen={creationModal.isOpen}
          type={creationModal.type}
          subjectId={creationModal.subjectId}
          subjectName={creationModal.subjectName}
          initialName={creationModal.suggestedName || ""}
          onClose={() => setCreationModal(null)}
          onSuccess={handleTaxonomyCreated}
        />
      )}
    </div>
  );
};
