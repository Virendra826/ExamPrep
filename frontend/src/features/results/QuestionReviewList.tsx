import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Lightbulb,
  Check,
  X,
} from "lucide-react";
import type { QuestionReviewItem } from "../../types/results";
import { RichQuestionText } from "../../components/common/RichText";

interface QuestionReviewListProps {
  questions: QuestionReviewItem[];
}

export const QuestionReviewList: React.FC<QuestionReviewListProps> = ({ questions }) => {
  const [filter, setFilter] = useState<"ALL" | "CORRECT" | "INCORRECT" | "UNATTEMPTED">("ALL");

  const filteredQuestions = questions.filter((q) => {
    if (filter === "CORRECT") return q.is_correct;
    if (filter === "INCORRECT") return !q.is_correct && q.selected_option != null && q.selected_option.trim() !== "";
    if (filter === "UNATTEMPTED") return q.selected_option == null || q.selected_option.trim() === "";
    return true;
  });

  const correctCount = questions.filter((q) => q.is_correct).length;
  const incorrectCount = questions.filter(
    (q) => !q.is_correct && q.selected_option != null && q.selected_option.trim() !== ""
  ).length;
  const unattemptedCount = questions.filter(
    (q) => q.selected_option == null || q.selected_option.trim() === ""
  ).length;

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          Question Review & Explanations
        </h2>

        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "ALL"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({questions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("CORRECT")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "CORRECT"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Correct ({correctCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("INCORRECT")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "INCORRECT"
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Incorrect ({incorrectCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("UNATTEMPTED")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === "UNATTEMPTED"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Unattempted ({unattemptedCount})
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {filteredQuestions.map((q) => {
          const isUnattempted = q.selected_option == null || q.selected_option.trim() === "";

          return (
            <div
              key={q.quiz_question_id}
              className={`rounded-2xl border p-6 backdrop-blur-sm space-y-5 transition-all ${
                q.is_correct
                  ? "bg-slate-900/60 border-emerald-500/30"
                  : isUnattempted
                  ? "bg-slate-900/60 border-slate-800"
                  : "bg-slate-900/60 border-red-500/30"
              }`}
            >
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-3 py-1 rounded-lg">
                    Q{q.display_order}
                  </span>
                  <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60">
                    {q.question_type}
                  </span>
                  {q.exam_name && (
                    <span className="text-xs font-medium text-amber-300 bg-amber-950/30 border border-amber-800/40 px-3 py-1 rounded-lg">
                      {q.exam_name} {q.exam_year}
                    </span>
                  )}
                  {q.difficulty && (
                    <span className="text-xs font-medium text-slate-300 bg-slate-800/60 border border-slate-700/60 px-3 py-1 rounded-lg">
                      {q.difficulty}
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  {q.is_correct ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct (+1)
                    </span>
                  ) : isUnattempted ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <HelpCircle className="w-3.5 h-3.5" /> Unattempted (0)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                      <XCircle className="w-3.5 h-3.5" /> Incorrect (0)
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <RichQuestionText
                text={q.question_text}
                className="text-base font-medium text-slate-100 leading-relaxed"
              />

              {/* Options Breakdown */}
              <div className="space-y-2.5">
                {q.options.map((option, optIdx) => {
                  const optId = typeof option === "string" ? option : option.id;
                  const optText = typeof option === "string" ? option : option.text;
                  const letter = String.fromCharCode(65 + optIdx);

                  const isUserChoice =
                    Boolean(q.selected_option) &&
                    (q.selected_option?.trim().toLowerCase() === optText.trim().toLowerCase() ||
                      (optId && q.selected_option?.trim().toLowerCase() === optId.trim().toLowerCase()) ||
                      q.selected_option?.trim().toLowerCase() === letter.toLowerCase());

                  const isCorrectAnswer =
                    q.correct_answer?.trim().toLowerCase() === optText.trim().toLowerCase() ||
                    (optId && q.correct_answer?.trim().toLowerCase() === optId.trim().toLowerCase()) ||
                    q.correct_answer?.trim().toLowerCase() === letter.toLowerCase();

                  let rowStyle = "bg-slate-800/40 border-slate-700/60 text-slate-300";
                  let badge = null;

                  if (isCorrectAnswer && isUserChoice) {
                    rowStyle = "bg-emerald-500/15 border-emerald-500 text-emerald-200 font-semibold ring-1 ring-emerald-500/30";
                    badge = (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 px-2 py-0.5 rounded">
                          Your Answer
                        </span>
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Correct
                        </span>
                      </div>
                    );
                  } else if (isCorrectAnswer) {
                    rowStyle = "bg-emerald-500/10 border-emerald-500/50 text-emerald-200 font-semibold";
                    badge = (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Correct Answer
                      </span>
                    );
                  } else if (isUserChoice) {
                    rowStyle = "bg-red-500/10 border-red-500/50 text-red-200";
                    badge = (
                      <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
                        <X className="w-3.5 h-3.5" /> Your Answer
                      </span>
                    );
                  }

                  return (
                    <div
                      key={optText}
                      className={`p-3.5 rounded-xl border text-sm flex items-center justify-between gap-3 ${rowStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold flex items-center justify-center text-slate-400 flex-shrink-0">
                          {letter}
                        </span>
                        <span>{optText}</span>
                      </div>
                      {badge}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Card */}
              {q.explanation && (
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-1.5">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                    <Lightbulb className="w-4 h-4" /> Explanation
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {q.explanation}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
