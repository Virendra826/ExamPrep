import React from "react";
import { AlertTriangle, CheckCircle, X } from "lucide-react";

interface SubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
}

export const SubmitConfirmModal: React.FC<SubmitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  totalQuestions,
  answeredCount,
  unansweredCount,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 id="submit-modal-title" className="text-lg font-bold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-indigo-400" />
            Submit Quiz
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <p className="text-sm text-slate-300">
            Are you sure you want to finish and submit your quiz attempt?
          </p>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3">
              <span className="block text-xs font-semibold text-slate-400">Total</span>
              <span className="text-xl font-bold text-white">{totalQuestions}</span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3">
              <span className="block text-xs font-semibold text-emerald-400">Answered</span>
              <span className="text-xl font-bold text-emerald-300">{answeredCount}</span>
            </div>
            <div className="bg-amber-950/40 border border-amber-800/50 rounded-xl p-3">
              <span className="block text-xs font-semibold text-amber-400">Unanswered</span>
              <span className="text-xl font-bold text-amber-300">{unansweredCount}</span>
            </div>
          </div>

          {unansweredCount > 0 && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                You still have <strong>{unansweredCount}</strong> unanswered question(s). Once submitted, answers cannot be modified.
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Return to Quiz
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
          >
            {isSubmitting ? "Submitting..." : "Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};
