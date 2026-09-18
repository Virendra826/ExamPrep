import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Layers,
  CheckCircle2,
  Edit3,
  FileUp,
  ArrowRight,
  Loader2,
  AlertCircle,
  Sparkles,
  HelpCircle,
  RefreshCw,
} from "lucide-react";
import { adminApi } from "../../../api/admin.api";
import type { AdminDashboardSummary } from "../../../types/admin";

interface AdminDashboardHomeProps {
  onNavigate: (tab: "curriculum" | "questions" | "ingestion") => void;
}

export const AdminDashboardHome: React.FC<AdminDashboardHomeProps> = ({ onNavigate }) => {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await adminApi.getDashboardSummary();
      setSummary(res.summary);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load admin dashboard summary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="space-y-8">
      {/* Overview Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" /> Platform Inventory Overview
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time counts of curriculum subjects, chapters, questions, and ingestion jobs.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Stats</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchSummary}
            className="text-xs font-bold underline hover:text-red-300"
          >
            Try Again
          </button>
        </div>
      )}

      {loading ? (
        <div className="min-h-[25vh] flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <p className="text-sm font-medium">Aggregating platform metrics...</p>
        </div>
      ) : summary ? (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Subjects</span>
                <BookOpen className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {summary.subjects_count}
              </div>
              <div className="text-xs text-slate-400 mt-1">Configured subjects</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Chapters</span>
                <Layers className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white">
                {summary.chapters_count}
              </div>
              <div className="text-xs text-slate-400 mt-1">Taxonomy modules</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Active Qs</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-300">
                {summary.active_questions_count}
              </div>
              <div className="text-xs text-slate-400 mt-1">Ready for quizzes</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Draft Qs</span>
                <Edit3 className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-amber-300">
                {summary.draft_questions_count}
              </div>
              <div className="text-xs text-slate-400 mt-1">Awaiting review</div>
            </div>

            <div className="col-span-2 md:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Pending Batches</span>
                <FileUp className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-300">
                {summary.pending_batches_count}
              </div>
              <div className="text-xs text-slate-400 mt-1">PDF pipelines</div>
            </div>
          </div>

          {/* Navigation Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {/* Curriculum Card */}
            <div
              onClick={() => onNavigate("curriculum")}
              className="group cursor-pointer bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
                  Curriculum & Subjects
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Manage syllabus subjects, descriptions, active status, and drill down into individual chapter modules.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                <span>Manage Curriculum</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Question Bank Card */}
            <div
              onClick={() => onNavigate("questions")}
              className="group cursor-pointer bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  Question Bank Inventory
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Search, filter, create, edit, or deactivate multiple choice questions across CONCEPT and PYQ types.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-purple-400 group-hover:translate-x-1 transition-transform">
                <span>Manage Questions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* PDF Ingestion Card */}
            <div
              onClick={() => onNavigate("ingestion")}
              className="group cursor-pointer bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/10 flex flex-col justify-between"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <FileUp className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  PDF Batch Ingestion
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Upload past question paper PDFs, trigger extraction heuristics, and bulk-review candidate drafts.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
                <span>Open PDF Pipeline</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
