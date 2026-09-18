import { useState, useEffect, useCallback } from "react";
import { subjectsApi } from "../../../api/subjects.api";
import { DataTable, type Column } from "../../../components/common/DataTable";
import { Badge } from "../../../components/common/Badge";
import { ConfirmDialog } from "../../../components/common/ConfirmDialog";
import { SubjectFormModal } from "./SubjectFormModal";
import type { Subject } from "../../../types/curriculum";
import type { SubjectFormData } from "../../../validation/curriculum";
import { Plus, Edit2, PowerOff, BookOpen, AlertCircle } from "lucide-react";

interface SubjectListProps {
  onSelectSubject: (subject: Subject) => void;
}

export const SubjectList: React.FC<SubjectListProps> = ({ onSelectSubject }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(true);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedSubjectForEdit, setSelectedSubjectForEdit] = useState<Subject | null>(null);
  const [subjectToDeactivate, setSubjectToDeactivate] = useState<Subject | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchSubjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await subjectsApi.getSubjects({
        page,
        limit: 10,
        includeInactive,
      });
      setSubjects(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load subjects");
    } finally {
      setIsLoading(false);
    }
  }, [page, includeInactive]);

  useEffect(() => {
    void fetchSubjects();
  }, [fetchSubjects]);

  const handleCreateOrUpdate = async (formData: SubjectFormData) => {
    if (selectedSubjectForEdit) {
      await subjectsApi.updateSubject(selectedSubjectForEdit.id, formData);
    } else {
      await subjectsApi.createSubject(formData);
    }
    await fetchSubjects();
  };

  const handleDeactivate = async () => {
    if (!subjectToDeactivate) return;
    setIsDeactivating(true);
    try {
      await subjectsApi.deactivateSubject(subjectToDeactivate.id);
      setSubjectToDeactivate(null);
      await fetchSubjects();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to deactivate subject");
    } finally {
      setIsDeactivating(false);
    }
  };

  const columns: Column<Subject>[] = [
    {
      header: "Subject Name",
      accessor: "name",
      render: (subject) => (
        <div>
          <button
            type="button"
            onClick={() => onSelectSubject(subject)}
            className="font-semibold text-white hover:text-indigo-400 transition-colors text-left flex items-center space-x-2"
          >
            <span>{subject.name}</span>
          </button>
          {subject.description && (
            <p className="text-xs text-slate-400 truncate max-w-md mt-0.5">
              {subject.description}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Chapters",
      accessor: "chapter_count",
      render: (subject) => (
        <span className="font-mono text-xs text-slate-300">
          {subject.chapter_count ?? 0} chapters
        </span>
      ),
    },
    {
      header: "Status",
      accessor: "is_active",
      render: (subject) => (
        <Badge variant={subject.is_active ? "success" : "neutral"}>
          {subject.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      headerClassName: "text-right",
      render: (subject) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => onSelectSubject(subject)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors"
            title="Manage Chapters"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedSubjectForEdit(subject);
              setIsFormModalOpen(true);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Edit Subject"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {subject.is_active && (
            <button
              type="button"
              onClick={() => setSubjectToDeactivate(subject)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              title="Deactivate Subject"
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
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Curriculum Subjects</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure subjects and organize topic chapters for quiz question categorization.
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
              setSelectedSubjectForEdit(null);
              setIsFormModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Subject</span>
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

      {/* Subjects Data Table */}
      <DataTable
        columns={columns}
        data={subjects}
        isLoading={isLoading}
        emptyMessage="No subjects yet — create one to get started."
        keyExtractor={(item) => item.id}
        pagination={{
          page,
          totalPages,
          total,
          onPageChange: (newPage) => setPage(newPage),
        }}
      />

      {/* Create / Edit Modal */}
      <SubjectFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedSubjectForEdit(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialSubject={selectedSubjectForEdit}
      />

      {/* Deactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!subjectToDeactivate}
        onClose={() => setSubjectToDeactivate(null)}
        onConfirm={handleDeactivate}
        title="Deactivate Subject"
        message={`Are you sure you want to deactivate "${subjectToDeactivate?.name}"? The subject and its chapters will be preserved in the database but hidden from active study paths.`}
        confirmLabel="Deactivate"
        isDangerous={true}
        isLoading={isDeactivating}
      />
    </div>
  );
};
