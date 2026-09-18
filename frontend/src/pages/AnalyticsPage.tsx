import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Trophy,
  Target,
  TrendingUp,
  Clock,
  Activity,
  Sparkles,
  AlertCircle,
  Loader2,
  BookOpen,
} from "lucide-react";
import { analyticsApi } from "../api/analytics.api";
import type { AnalyticsSummary, ChapterPerformance } from "../types/analytics";

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [chapters, setChapters] = useState<ChapterPerformance[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchAnalytics() {
      try {
        setLoading(true);
        setError(null);
        const [sumRes, chapRes] = await Promise.all([
          analyticsApi.getSummary(),
          analyticsApi.getChapterPerformance(),
        ]);
        if (isMounted) {
          setSummary(sumRes.summary);
          setChapters(chapRes.chapters);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAnalytics();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-indigo-400" /> Performance Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Track aggregate accuracy, timing, and topic-level strengths over time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-colors"
          >
            View History
          </button>
          <button
            type="button"
            onClick={() => navigate("/quiz/new")}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4" /> Start New Quiz
          </button>
        </div>
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
          <p className="text-sm font-medium">Computing analytics summary...</p>
        </div>
      ) : !summary || summary.total_attempts === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <Activity className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">No analytics data yet</h2>
          <p className="text-sm text-slate-400">
            Complete your first evaluated quiz to generate insights on your accuracy, speed, and chapter mastery.
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
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Attempts</span>
                <Activity className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {summary.total_attempts}
              </div>
              <div className="text-xs text-slate-400 mt-1">Evaluated quizzes</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Best Score</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300">
                {summary.best_score}
              </div>
              <div className="text-xs text-slate-400 mt-1">Highest marks</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Avg Score</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                {summary.average_percentage}%
              </div>
              <div className="text-xs text-slate-400 mt-1">Overall percentage</div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Accuracy</span>
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-300">
                {summary.average_accuracy}%
              </div>
              <div className="text-xs text-slate-400 mt-1">Attempt accuracy</div>
            </div>

            <div className="col-span-2 md:col-span-1 bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Speed</span>
                <Clock className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-violet-300">
                {summary.average_time_per_question}s
              </div>
              <div className="text-xs text-slate-400 mt-1">Avg / question</div>
            </div>
          </div>

          {/* Chapter Breakdown */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl space-y-4">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" /> Chapter Performance Breakdown
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Detailed evaluation stats grouped by chapter
                </p>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {chapters.length} {chapters.length === 1 ? "Chapter" : "Chapters"}
              </span>
            </div>

            {chapters.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No chapter-specific quiz data recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-850/80 border-b border-slate-800 text-xs uppercase font-semibold text-slate-400">
                    <tr>
                      <th className="px-6 py-3.5">Subject & Chapter</th>
                      <th className="px-6 py-3.5 text-center">Attempts</th>
                      <th className="px-6 py-3.5">Avg Score</th>
                      <th className="px-6 py-3.5">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {chapters.map((chap) => (
                      <tr key={chap.chapter_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-white">{chap.chapter_name}</div>
                          <div className="text-xs text-slate-400">{chap.subject_name}</div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {chap.attempt_count}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden flex-shrink-0">
                              <div
                                className="bg-indigo-500 h-2 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, chap.average_percentage))}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-slate-200">
                              {chap.average_percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 bg-slate-800 rounded-full h-2 overflow-hidden flex-shrink-0">
                              <div
                                className="bg-emerald-500 h-2 rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, chap.average_accuracy))}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-slate-200">
                              {chap.average_accuracy}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
};

export default AnalyticsPage;
