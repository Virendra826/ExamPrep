import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  History,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { attemptsApi } from "../api/attempts.api";
import type { AttemptHistoryItem } from "../types/attempts";
import { formatDuration } from "../hooks/useTimer";

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptHistoryItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    async function loadHistory() {
      try {
        setLoading(true);
        setError(null);
        const res = await attemptsApi.getHistory({ page, limit: 10 });
        if (isMounted) {
          setAttempts(res.data);
          setTotalPages(res.pagination.totalPages || 1);
          setTotal(res.pagination.total || 0);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load attempt history");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
    };
  }, [page]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <History className="w-7 h-7 text-indigo-400" /> Quiz Attempt History
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review past study sessions, scores, and evaluation breakdowns.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/quiz/new")}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" /> Start New Quiz
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm font-medium">Loading history...</p>
        </div>
      ) : attempts.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <History className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">No attempts yet</h2>
          <p className="text-sm text-slate-400">
            You haven't completed any quizzes yet. Start a session to track your exam readiness!
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate("/quiz/new")}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
            >
              Start Your First Quiz
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-850/80 border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
                <tr>
                  <th className="px-6 py-4">Subject & Chapter</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attempts.map((a) => {
                  const isEvaluated = a.status === "EVALUATED";
                  const dateStr = new Date(a.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white">{a.quiz.subject.name}</div>
                        <div className="text-xs text-slate-400">
                          {a.quiz.chapter?.name || "All Chapters"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isEvaluated
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : a.status === "IN_PROGRESS"
                              ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                              : a.status === "TIMEOUT"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isEvaluated && a.score != null ? (
                          <div>
                            <span className="font-bold text-white">
                              {a.score} / {a.total_marks}
                            </span>
                            <span className="text-xs text-slate-400 ml-1.5">
                              ({a.percentage}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {a.time_taken_seconds != null
                            ? formatDuration(a.time_taken_seconds)
                            : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">{dateStr}</td>
                      <td className="px-6 py-4 text-right">
                        {isEvaluated ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/attempts/${a.id}/results`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-colors"
                          >
                            Review <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/attempts/${a.id}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                          >
                            Resume <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 text-xs text-slate-400">
              <div>
                Showing page <strong className="text-white">{page}</strong> of{" "}
                <strong className="text-white">{totalPages}</strong> ({total} total attempts)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 disabled:opacity-40 hover:bg-slate-800 text-white font-medium flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 disabled:opacity-40 hover:bg-slate-800 text-white font-medium flex items-center gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default HistoryPage;
