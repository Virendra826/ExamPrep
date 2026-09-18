import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import { AdminDashboardHome } from "../features/admin/dashboard/AdminDashboardHome";
import { SubjectList } from "../features/admin/subjects/SubjectList";
import { ChapterList } from "../features/admin/chapters/ChapterList";
import { QuestionList } from "../features/admin/questions/QuestionList";
import { PdfUploadView } from "../features/admin/ingestion/PdfUploadView";
import type { Subject } from "../types/curriculum";
import {
  ShieldCheck,
  Sparkles,
  LayoutDashboard,
  BookOpen,
  HelpCircle,
  FileUp,
} from "lucide-react";

export type AdminTab = "overview" | "curriculum" | "questions" | "ingestion";

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  // Determine active tab: defaults to overview if not explicitly set to curriculum/questions/ingestion
  const activeTab: AdminTab =
    tabParam === "questions"
      ? "questions"
      : tabParam === "ingestion"
      ? "ingestion"
      : tabParam === "curriculum"
      ? "curriculum"
      : "overview";

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  const handleTabChange = (tab: AdminTab) => {
    setSelectedSubject(null);
    if (tab === "overview") {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Admin Header Banner */}
      <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Sparkles className="w-3 h-3 mr-1" /> Admin Dashboard
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">
                Welcome, {user?.name} ({user?.role})
              </h1>
            </div>
          </div>
          <p className="text-xs text-slate-400 max-w-sm sm:text-right">
            Manage curriculum taxonomy, configure subjects and chapters, and manage the central question bank inventory.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => handleTabChange("overview")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "overview"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("curriculum")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "curriculum"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Curriculum</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("questions")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "questions"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Question Bank</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("ingestion")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "ingestion"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <FileUp className="w-4 h-4" />
            <span>PDF Ingestion</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Area */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm shadow-lg">
        {activeTab === "overview" ? (
          <AdminDashboardHome onNavigate={(tab) => handleTabChange(tab)} />
        ) : activeTab === "ingestion" ? (
          <PdfUploadView onNavigateToQuestions={() => handleTabChange("questions")} />
        ) : activeTab === "questions" ? (
          <QuestionList />
        ) : selectedSubject ? (
          <ChapterList
            subject={selectedSubject}
            onBack={() => setSelectedSubject(null)}
          />
        ) : (
          <SubjectList onSelectSubject={(subject) => setSelectedSubject(subject)} />
        )}
      </div>
    </main>
  );
};

export default AdminPage;
