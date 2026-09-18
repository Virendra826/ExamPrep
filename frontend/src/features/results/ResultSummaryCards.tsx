import React from "react";
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
} from "lucide-react";
import type { QuizResultData } from "../../types/results";
import { formatDuration } from "../../hooks/useTimer";

interface ResultSummaryCardsProps {
  result: QuizResultData;
}

export const ResultSummaryCards: React.FC<ResultSummaryCardsProps> = ({ result }) => {
  const isPassed = result.percentage >= 50;

  return (
    <div className="space-y-6">
      {/* Hero Performance Card */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-900/60 to-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-lg ${
                isPassed
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-400"
              }`}
            >
              <Award className="w-9 h-9" />
            </div>
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Evaluation Result
              </span>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {result.marks_obtained} / {result.total_marks} Marks
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {isPassed ? "Great job! Keep up the momentum." : "Needs practice. Review concepts below."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Percentage</span>
              <span className="text-3xl font-black text-indigo-400 font-mono">
                {result.percentage}%
              </span>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div className="text-center">
              <span className="text-xs uppercase font-bold text-slate-400 block mb-1">Accuracy</span>
              <span className="text-3xl font-black text-emerald-400 font-mono">
                {result.accuracy}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Correct</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-bold text-emerald-400">{result.correct_count}</span>
          <span className="text-xs text-slate-500 block mt-1">questions</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Incorrect</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <span className="text-2xl font-bold text-red-400">{result.incorrect_count}</span>
          <span className="text-xs text-slate-500 block mt-1">questions</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Unattempted</span>
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-2xl font-bold text-amber-400">{result.unattempted_count}</span>
          <span className="text-xs text-slate-500 block mt-1">questions</span>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
            <span>Time Taken</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold text-indigo-300 font-mono">
            {formatDuration(result.time_taken_seconds)}
          </span>
          <span className="text-xs text-slate-500 block mt-1">duration</span>
        </div>
      </div>
    </div>
  );
};
