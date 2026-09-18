import React, { useState, useEffect } from "react";
import { subjectsApi } from "../../../api/subjects.api";
import { chaptersApi } from "../../../api/chapters.api";
import type { Subject, Chapter } from "../../../types/curriculum";
import { Plus, X, Loader2, AlertCircle, BookOpen, Layers } from "lucide-react";

export interface InlineTaxonomyModalProps {
  isOpen: boolean;
  type: "SUBJECT" | "CHAPTER";
  subjectId?: string;
  subjectName?: string;
  initialName?: string;
  onClose: () => void;
  onSuccess: (created: { type: "SUBJECT" | "CHAPTER"; subject?: Subject; chapter?: Chapter }) => void;
}

export const InlineTaxonomyModal: React.FC<InlineTaxonomyModalProps> = ({
  isOpen,
  type,
  subjectId,
  subjectName,
  initialName = "",
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription("");
      setErrorMessage(null);
      setIsLoading(false);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(`${type === "SUBJECT" ? "Subject" : "Chapter"} name is required.`);
      return;
    }

    if (type === "CHAPTER" && !subjectId) {
      setErrorMessage("A valid Subject must be selected to create a Chapter.");
      return;
    }

    setIsLoading(true);
    try {
      if (type === "SUBJECT") {
        const res = await subjectsApi.createSubject({
          name: trimmedName,
          description: description.trim() || undefined,
        });
        onSuccess({ type: "SUBJECT", subject: res.subject });
      } else {
        const res = await chaptersApi.createChapter({
          subject_id: subjectId!,
          name: trimmedName,
          description: description.trim() || undefined,
        });
        onSuccess({ type: "CHAPTER", chapter: res.chapter });
      }
      onClose();
    } catch (err: any) {
      // Gracefully handle 409 Conflict or validation errors
      const msg = err?.message || `Failed to create ${type.toLowerCase()}. Please try again.`;
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inline-taxonomy-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              {type === "SUBJECT" ? (
                <BookOpen className="w-4 h-4" />
              ) : (
                <Layers className="w-4 h-4" />
              )}
            </div>
            <div>
              <h3 id="inline-taxonomy-modal-title" className="text-base font-bold text-white">
                {type === "SUBJECT" ? "Create New Subject" : "Create New Chapter"}
              </h3>
              {type === "CHAPTER" && subjectName && (
                <p className="text-xs text-slate-400">
                  Under Subject: <strong className="text-slate-200">{subjectName}</strong>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {type === "SUBJECT" ? "Subject Name" : "Chapter Name"}{" "}
              <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              data-testid="inline-taxonomy-name-input"
              aria-label={type === "SUBJECT" ? "New Subject Name" : "New Chapter Name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "SUBJECT"
                  ? "e.g. Thermodynamics, Computer Networks"
                  : "e.g. Work Power Energy, Cache Memory"
              }
              className="block w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              aria-label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview or topic coverage..."
              className="block w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>
                {isLoading
                  ? "Creating..."
                  : type === "SUBJECT"
                  ? "Create Subject"
                  : "Create Chapter"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
