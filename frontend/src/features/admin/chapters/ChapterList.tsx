import { useState, useEffect, useCallback } from "react";
import { chaptersApi } from "../../../api/chapters.api";
import { DataTable, type Column } from "../../../components/common/DataTable";
import { Badge } from "../../../components/common/Badge";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { ChapterFormModal } from "./ChapterFormModal";
import type { Subject, Chapter } from "../../../types/curriculum";
import type { ChapterFormData } from "../../../validation/curriculum";
import { ArrowLeft, Plus, Edit2, PowerOff, AlertCircle } from "lucide-react";

interface ChapterListProps {
  subject: Subject;
  onBack: () => void;
}

export const ChapterList: React.FC<ChapterListProps> = ({ subject, onBack }) => {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedChapterForEdit, setSelectedChapterForEdit] = useState<Chapter | null>(null);
  const [chapterToDeactivate, setChapterToDeactivate] = useState<Chapter | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchChapters = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await chaptersApi.getChaptersBySubject(subject.id, {
        page,
        limit: 10,
        includeInactive,
      });
      setChapters(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load chapters");
    } finally {
      setIsLoading(false);
    }
  }, [subject.id, page, includeInactive]);

  useEffect(() => {
    void fetchChapters();
  }, [fetchChapters]);

  const handleCreateOrUpdate = async (formData: ChapterFormData) => {
    if (selectedChapterForEdit) {
      await chaptersApi.updateChapter(selectedChapterForEdit.id, formData);
    } else {
      await chaptersApi.createChapter({
        subject_id: subject.id,
        name: formData.name,
        description: formData.description,
      });
    }
    await fetchChapters();
  };

  const handleDeactivate = async () => {
    if (!chapterToDeactivate) return;
    setIsDeactivating(true);
    try {
      await chaptersApi.deactivateChapter(chapterToDeactivate.id);
      setChapterToDeactivate(null);
      await fetchChapters();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deactivate chapter");
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: Column<Chapter>[] = [
    {
      header: "Chapter Name",
      accessor: "name",
      render: (chapter) => (
        <div>
          <div className="font-semibold text-white">{chapter.name}</div>
          {chapter.description && (
            <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">
              {chapter.description}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Questions",
      accessor: "question_count",
      render: (chapter) => (
        <span className="font-mono text-xs text-slate-300">
          {chapter.question_count ?? 0} questions
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "is_active",
      render: (chapter) => (
        <Badge variant={chapter.is_active ? "success" : "neutral"}>
          {chapter.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      headerClassName: "text-right",
      render: (chapter) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => {
              setSelectedChapterForEdit(chapter);
              setIsFormModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Edit Chapter"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {chapter.is_active && (
            <button
              type="button"
              onClick={() => setChapterToDeactivate(chapter)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              title="Deactivate Chapter"
            >
              <PowerOff className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-400">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Subjects</span>
        </button>
        <span>/</span>
        <span className="text-slate-200 font-semibold truncate max-w-xs">{subject.name}</span>
        <span>/</span>
        <span>Chapters</span>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Chapters in <span className="text-indigo-400">{subject.name}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage granular topic chapters used to assemble practice tests and subject quizzes.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500/20 bg-slate-800"
            />
            <span>Show Inactive</span>
          </label>

          <button
            type="button"
            onClick={() => {
              setSelectedChapterForEdit(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Chapter</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Chapters Data Table */}
      <DataTable
        columns={columns}
        data={chapters}
        isLoading={isLoading}
        emptyMessage="No chapters yet — create one to get started."
        keyExtractor={(item) => item.id}
        pagination={{
          page,
          totalPages,
          total,
          onPageChange: (newPage) => setPage(newPage),
        }}
      />

      {/* Create / Edit Modal */}
      <ChapterFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedChapterForEdit(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialChapter={selectedChapterForEdit}
        subjectName={subject.name}
      />

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!chapterToDeactivate}
        onClose={() => setChapterToDeactivate(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Chapter"
        message={`Are you sure you want to deactivate "${chapterToDeactivate?.name}"? Questions under this chapter will be preserved but this chapter will be hidden from new quiz generations.`}
        confirmLabel="Deactivate"
        isDangerous={true}
        isLoading={isDeactivating}
      />
    </div>
  );
};
