import { useState, useEffect } from "react";
import { Modal } from "../../../components/common/Modal";
import { subjectFormSchema, type SubjectFormData } from "../../../validation/curriculum";
import { ApiError } from "../../../api/apiClient";
import type { Subject } from "../../../types/curriculum";
import { AlertCircle, Loader2 } from "lucide-react";

interface SubjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SubjectFormData) => Promise<void>;
  initialSubject?: Subject | null;
}

export const SubjectFormModal: React.FC<SubjectFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialSubject,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; description?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!initialSubject;

  useEffect(() => {
    if (initialSubject) {
      setName(initialSubject.name);
      setDescription(initialSubject.description || "");
    } else {
      setName("");
      setDescription("");
    }
    setFieldErrors({});
    setServerError(null);
  }, [initialSubject, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    const result = subjectFormSchema.safeParse({ name, description });
    if (!result.success) {
      const formatted: { name?: string; description?: string } = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as "name" | "description";
        if (path && !formatted[path]) {
          formatted[path] = issue.message;
        }
      });
      setFieldErrors(formatted);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(result.data);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setServerError("A subject with this name already exists.");
        } else {
          setServerError(err.message);
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("Failed to save subject. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Subject" : "Create New Subject"}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{serverError}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="subject-name"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1"
          >
            Subject Name <span className="text-rose-400">*</span>
          </label>
          <input
            id="subject-name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Computer Networks"
            className={`block w-full px-3.5 py-2.5 bg-slate-800/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              fieldErrors.name
                ? "border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-slate-700/80 focus:border-indigo-500 focus:ring-indigo-500/20"
            }`}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-rose-400" role="alert">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="subject-description"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1"
          >
            Description <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <textarea
            id="subject-description"
            name="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Key concepts, syllabus scope, or exam relevance..."
            className="block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          {fieldErrors.description && (
            <p className="mt-1 text-xs text-rose-400" role="alert">
              {fieldErrors.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 disabled:opacity-60 transition-all"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            <span>{isEditing ? "Save Changes" : "Create Subject"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
