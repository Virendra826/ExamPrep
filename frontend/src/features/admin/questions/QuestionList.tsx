import React, { useState, useEffect, useCallback } from "react";
import { questionsApi } from "../../../api/questions.api";
import { subjectsApi } from "../../../api/subjects.api";
import { chaptersApi } from "../../../api/chapters.api";
import { DataTable, type Column } from "../../../components/common/DataTable";
import { Badge } from "../../../components/common/Badge";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { QuestionFormModal } from "./QuestionFormModal";
import type { Question, QuestionType, QuestionStatus } from "../../../types/questions";
import type { Subject, Chapter } from "../../../types/curriculum";
import {
  Plus,
  Edit2,
  PowerOff,
  Search,
  X,
  AlertCircle,
  GraduationCap,
  Sparkles,
} from "lucide-react";

export const QuestionList: React.FC = () => {
  // Questions table state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<QuestionType | "">("");
  const [selectedStatus, setSelectedStatus] = useState<QuestionStatus | "">("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Subjects & Chapters lookup lists for filter dropdowns
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedQuestionForEdit, setSelectedQuestionForEdit] = useState<Question | null>(null);
  const [questionToDeactivate, setQuestionToDeactivate] = useState<Question | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Load subjects for filter dropdown
  useEffect(() => {
    let isMounted = true;
    const loadSubjects = async () => {
      try {
        const res = await subjectsApi.getSubjects({ limit: 100, includeInactive: true });
        if (isMounted) setSubjects(res.data);
      } catch (err: unknown) {
        console.error("Failed to load subjects for filter:", err);
      }
    };
    void loadSubjects();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load chapters when selectedSubjectId changes
  useEffect(() => {
    let isMounted = true;
    if (!selectedSubjectId) {
      return;
    }
    const loadChapters = async () => {
      try {
        const res = await chaptersApi.getChaptersBySubject(selectedSubjectId, {
          limit: 100,
          includeInactive: true,
        });
        if (isMounted) setChapters(res.data);
      } catch (err: unknown) {
        console.error("Failed to load chapters for filter:", err);
      }
    };
    void loadChapters();
    return () => {
      isMounted = false;
    };
  }, [selectedSubjectId]);

  // Fetch questions from API
  const fetchQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await questionsApi.getQuestions({
        page,
        limit: 10,
        subject_id: selectedSubjectId || undefined,
        chapter_id: selectedChapterId || undefined,
        question_type: selectedType || undefined,
        status: selectedStatus || undefined,
        search: searchQuery.trim() || undefined,
      });
      setQuestions(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedSubjectId, selectedChapterId, selectedType, selectedStatus, searchQuery]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  // Handle filter changes (resets to page 1)
  const handleSubjectFilterChange = (subId: string) => {
    setSelectedSubjectId(subId);
    setSelectedChapterId("");
    if (!subId) {
      setChapters([]);
    }
    setPage(1);
  };

  const handleChapterFilterChange = (chapId: string) => {
    setSelectedChapterId(chapId);
    setPage(1);
  };

  const handleTypeFilterChange = (type: QuestionType | "") => {
    setSelectedType(type);
    setPage(1);
  };

  const handleStatusFilterChange = (status: QuestionStatus | "") => {
    setSelectedStatus(status);
    setPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSelectedSubjectId("");
    setSelectedChapterId("");
    setSelectedType("");
    setSelectedStatus("");
    setSearchQuery("");
    setChapters([]);
    setPage(1);
  };

  // Create / Update Question handler
  const handleCreateOrUpdate = async (formData: {
    question_text: string;
    options: { id?: string; text: string }[];
    correct_answer: string;
    subject_id: string;
    chapter_id: string;
    question_type: QuestionType;
    difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
    status?: QuestionStatus;
    exam_name?: string | null;
    exam_year?: number | null;
    explanation?: string | null;
  }) => {
    if (selectedQuestionForEdit) {
      await questionsApi.updateQuestion(selectedQuestionForEdit.id, formData);
    } else {
      await questionsApi.createQuestion(formData);
    }
    await fetchQuestions();
  };

  // Deactivate Question handler
  const handleDeactivate = async () => {
    if (!questionToDeactivate) return;
    setIsDeactivating(true);
    try {
      await questionsApi.deactivateQuestion(questionToDeactivate.id);
      setQuestionToDeactivate(null);
      await fetchQuestions();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deactivate question");
    } finally {
      setIsDeactivating(false);
    }
  };

  // Status badge renderer
  const renderStatusBadge = (status: QuestionStatus) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Active</Badge>;
      case "DRAFT":
        return <Badge variant="warning">Draft</Badge>;
      case "INACTIVE":
        return <Badge variant="neutral">Inactive</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Subject and chapter helper lookup
  const getSubjectName = (subId: string) => {
    const s = subjects.find((sub) => sub.id === subId);
    return s ? s.name : "Subject";
  };

  const getChapterName = (chapId: string) => {
    const c = chapters.find((chap) => chap.id === chapId);
    return c ? c.name : "Chapter";
  };

  // Table columns definition
  const columns: Column<Question>[] = [
    {
      header: "Question Text",
      accessor: "question_text",
      render: (q) => {
        const hasDiagram = q.question_text.includes("data:image/") || q.question_text.includes("![");
        const cleanText = q.question_text.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
        return (
          <div className="max-w-md py-1">
            <p className="font-semibold text-white line-clamp-2 text-sm leading-snug">
              {cleanText || q.question_text}
            </p>
            <div className="flex items-center space-x-2 mt-1.5 text-xs text-slate-400">
              <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                {q.options?.length ?? 0} options
              </span>
              {hasDiagram && (
                <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-1.5 py-0.5 rounded">
                  Diagram
                </span>
              )}
              {q.correct_answer && (
                <span className="text-[11px] text-emerald-400 truncate max-w-[200px]">
                  Key: {q.correct_answer}
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: "Curriculum Context",
      render: (q) => (
        <div className="text-xs space-y-0.5">
          <div className="font-medium text-slate-200">
            {q.subject?.name || getSubjectName(q.subject_id)}
          </div>
          <div className="text-slate-400 flex items-center space-x-1">
            <span>↳ {q.chapter?.name || getChapterName(q.chapter_id)}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Type",
      accessor: "question_type",
      render: (q) => (
        <div className="space-y-1">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
              q.question_type === "PYQ"
                ? "bg-amber-950/60 text-amber-300 border border-amber-800/50"
                : "bg-indigo-950/60 text-indigo-300 border border-indigo-800/50"
            }`}
          >
            {q.question_type === "PYQ" ? (
              <span className="flex items-center space-x-1">
                <GraduationCap className="w-3 h-3 mr-1" />
                <span>PYQ</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1">
                <Sparkles className="w-3 h-3 mr-1" />
                <span>Concept</span>
              </span>
            )}
          </span>
          {q.question_type === "PYQ" && q.exam_name && (
            <p className="text-[11px] text-slate-400 truncate max-w-[140px]" title={`${q.exam_name} ${q.exam_year || ""}`}>
              {q.exam_name} {q.exam_year ? `'${String(q.exam_year).slice(-2)}` : ""}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      accessor: "status",
      render: (q) => renderStatusBadge(q.status),
    },
    {
      header: "Actions",
      className: "text-right",
      headerClassName: "text-right",
      render: (q) => (
        <div className="flex items-center justify-end space-x-1.5">
          <button
            type="button"
            onClick={() => {
              setSelectedQuestionForEdit(q);
              setIsFormModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Edit Question"
            aria-label={`Edit question ${q.id}`}
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {q.status !== "INACTIVE" && (
            <button
              type="button"
              onClick={() => setQuestionToDeactivate(q)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              title="Deactivate Question"
              aria-label={`Deactivate question ${q.id}`}
            >
              <PowerOff className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const hasActiveFilters = Boolean(
    selectedSubjectId || selectedChapterId || selectedType || selectedStatus || searchQuery
  );

  return (
    <div className="space-y-6">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Question Bank</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Browse, filter, manually construct, and manage active question inventory.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedQuestionForEdit(null);
            setIsFormModalOpen(true);
          }}
          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Question</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search questions..."
              className="block w-full pl-9 pr-8 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter */}
          <div>
            <select
              aria-label="Filter by subject"
              value={selectedSubjectId}
              onChange={(e) => handleSubjectFilterChange(e.target.value)}
              className="block w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="">All Subjects</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Chapter Filter */}
          <div>
            <select
              aria-label="Filter by chapter"
              value={selectedChapterId}
              onChange={(e) => handleChapterFilterChange(e.target.value)}
              disabled={!selectedSubjectId}
              className="block w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
            >
              <option value="">
                {!selectedSubjectId ? "Select subject first" : "All Chapters"}
              </option>
              {chapters.map((chap) => (
                <option key={chap.id} value={chap.id}>
                  {chap.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type & Status Filters */}
          <div className="flex space-x-2">
            <select
              aria-label="Filter by question type"
              value={selectedType}
              onChange={(e) => handleTypeFilterChange(e.target.value as QuestionType | "")}
              className="flex-1 px-2.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="">All Types</option>
              <option value="CONCEPT">Concept</option>
              <option value="PYQ">PYQ</option>
            </select>

            <select
              aria-label="Filter by status"
              value={selectedStatus}
              onChange={(e) => handleStatusFilterChange(e.target.value as QuestionStatus | "")}
              className="flex-1 px-2.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 transition-all"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
            <span className="text-slate-400">
              Showing filtered results ({total} questions found)
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Questions Data Table */}
      <DataTable
        columns={columns}
        data={questions}
        isLoading={isLoading}
        emptyMessage="No questions match your current filters. Create a new question or adjust filters."
        keyExtractor={(q) => q.id}
        pagination={{
          page,
          totalPages,
          total,
          onPageChange: (newPage) => setPage(newPage),
        }}
      />

      {/* Create / Edit Question Modal */}
      <QuestionFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedQuestionForEdit(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialQuestion={selectedQuestionForEdit}
        defaultSubjectId={selectedSubjectId}
        defaultChapterId={selectedChapterId}
      />

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!questionToDeactivate}
        onClose={() => setQuestionToDeactivate(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Question"
        message={`Are you sure you want to deactivate this question? It will be marked as INACTIVE and excluded from new quizzes, but preserved for historical attempts.`}
        confirmLabel="Deactivate"
        isDangerous={true}
        isLoading={isDeactivating}
      />
    </div>
  );
};
