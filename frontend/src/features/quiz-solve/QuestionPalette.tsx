import React from "react";
import type { AttemptQuestion } from "../../types/attempts";
import { Check } from "lucide-react";

interface QuestionPaletteProps {
  questions: AttemptQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  onSelectQuestion: (index: number) => void;
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  questions,
  currentIndex,
  answers,
  onSelectQuestion,
}) => {
  return (
    <aside className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
        Question Navigation
      </h3>

      <div className="grid grid-cols-5 gap-2">
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIndex;
          const isAnswered = answers[q.quiz_question_id] !== undefined && answers[q.quiz_question_id] !== null && answers[q.quiz_question_id] !== "";

          let btnClass = "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700";
          if (isAnswered) {
            btnClass = "bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30";
          }
          if (isCurrent) {
            btnClass = "bg-indigo-600 border-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50";
          }

          return (
            <button
              key={q.quiz_question_id}
              type="button"
              onClick={() => onSelectQuestion(idx)}
              aria-label={`Go to question ${idx + 1}${isAnswered ? " (Answered)" : ""}`}
              aria-current={isCurrent ? "true" : undefined}
              className={`h-10 rounded-xl border text-sm font-semibold flex items-center justify-center relative transition-all ${btnClass}`}
            >
              <span>{idx + 1}</span>
              {isAnswered && !isCurrent && (
                <Check className="w-3 h-3 text-emerald-400 absolute bottom-1 right-1" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-indigo-600 border border-indigo-500 inline-block" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700 inline-block" />
          <span>Pending</span>
        </div>
      </div>
    </aside>
  );
};
