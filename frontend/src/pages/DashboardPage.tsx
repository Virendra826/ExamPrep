import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  History,
  BarChart3,
  ShieldCheck,
  BookOpen,
} from "lucide-react";

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-slate-800/50 to-slate-900/40 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1">
              <Sparkles className="w-3 h-3 mr-1" /> Student Learning Portal
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome, {user?.name} ({user?.role})
            </h1>
          </div>
        </div>
        <p className="text-slate-400 text-sm max-w-2xl">
          Your exam preparation workspace is active. Customize targeted quizzes, review detailed question explanations, and monitor your topic mastery.
        </p>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* New Quiz Card */}
        <Link
          to="/quiz/new"
          className="group bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">
              Configure & Start Quiz
            </h2>
            <p className="text-sm text-slate-400">
              Select your subject, chapter, question count, and timer mode to launch a personalized test session.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
            <span>Launch Quiz</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* History Card */}
        <Link
          to="/history"
          className="group bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <History className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-violet-300 transition-colors">
              Attempt History
            </h2>
            <p className="text-sm text-slate-400">
              Browse past attempts, resume incomplete sessions, and open question-by-question evaluations.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-violet-400 group-hover:translate-x-1 transition-transform">
            <span>View History</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Analytics Card */}
        <Link
          to="/analytics"
          className="group bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
              Performance Analytics
            </h2>
            <p className="text-sm text-slate-400">
              Inspect overall accuracy, score trajectories, speed, and chapter-wise strengths.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>View Analytics</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* Admin Quick Link if Admin */}
      {isAdmin && (
        <div className="bg-slate-900/40 border border-indigo-950/60 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Administrator Management</h3>
              <p className="text-xs text-slate-400">
                Manage curriculum subjects, chapters, questions, and PDF ingestion batches.
              </p>
            </div>
          </div>
          <Link
            to="/admin"
            className="px-4 py-2 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/40 text-sm font-semibold transition-colors flex items-center gap-2"
          >
            <span>Open Admin Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </main>
  );
};

export default DashboardPage;
