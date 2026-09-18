import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  RotateCcw,
  LayoutDashboard,
  Loader2,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { resultsApi } from "../api/results.api";
import type { QuizResultResponse } from "../types/results";
import { ResultSummaryCards } from "../features/results/ResultSummaryCards";
import { QuestionReviewList } from "../features/results/QuestionReviewList";

export const QuizResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QuizResultResponse | null>(null);

  useEffect(() => {
    if (!attemptId) return;

    let isMounted = true;
    async function loadResult() {
      try {
        setLoading(true);
        setError(null);
        const res = await resultsApi.getAttemptResult(attemptId!);
        if (isMounted) {
          setData(res);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load quiz evaluation");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadResult();
    return () => {
      isMounted = false;
    };
  }, [attemptId]);

  if (loading) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">Computing score and loading results...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-md mx-auto mt-16 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Evaluation Unavailable</h2>
        <p className="text-sm text-slate-400 mb-6">{error || "Unable to load result."}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {data.quiz.subject.name}
            </span>
            {data.quiz.chapter && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {data.quiz.chapter.name}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-indigo-400" /> Quiz Performance Report
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold flex items-center gap-2 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate("/quiz/new")}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            <RotateCcw className="w-4 h-4" /> Start New Quiz
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <ResultSummaryCards result={data.result} />

      {/* Detailed Question-wise Review */}
      <QuestionReviewList questions={data.questions} />
    </main>
  );
};

export default QuizResultPage;
