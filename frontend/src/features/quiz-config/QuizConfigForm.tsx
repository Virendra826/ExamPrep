import React, { useState, useEffect, useId } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  FolderTree,
  FileQuestion,
  Hash,
  Shuffle,
  Clock,
  Play,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { subjectsApi, chaptersApi, questionsApi, quizApi } from "../../api";
import type { Subject, Chapter } from "../../types/curriculum";
import type { QuestionTypeFilter, OrderMode, TimerMode } from "../../types/quiz";
import { quizConfigSchema, MAX_QUIZ_QUESTION_COUNT } from "../../validation/quizConfig";

export const QuizConfigForm: React.FC = () => {
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);

  // Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [questionType, setQuestionType] = useState<QuestionTypeFilter>("BOTH");
  const [requestedCount, setRequestedCount] = useState<number>(10);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [orderMode, setOrderMode] = useState<OrderMode>("RANDOM");
  const [timerMode, setTimerMode] = useState<TimerMode>("VARIABLE");
  const [timerMinutes, setTimerMinutes] = useState<number>(15);

  // Availability & Validation State
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load Subjects on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSubjects() {
      try {
        setLoadingSubjects(true);
        const res = await subjectsApi.getSubjects({ limit: 100 });
        if (isMounted) {
          const activeSubjects = res.data.filter((s) => s.is_active);
          setSubjects(activeSubjects);
          if (activeSubjects.length > 0) {
            setSelectedSubjectId(activeSubjects[0].id);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setServerError(err instanceof Error ? err.message : "Failed to load subjects");
        }
      } finally {
        if (isMounted) setLoadingSubjects(false);
      }
    }
    loadSubjects();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Chapters when Subject changes
  useEffect(() => {
    let isMounted = true;
    async function loadChapters() {
      if (!selectedSubjectId) {
        setChapters([]);
        setSelectedChapterId("");
        return;
      }
      try {
        setLoadingChapters(true);
        const res = await chaptersApi.getChapters(selectedSubjectId, { limit: 100 });
        if (isMounted) {
          const activeChapters = res.data.filter((c) => c.is_active);
          setChapters(activeChapters);
          setSelectedChapterId(""); // Default to "All Chapters"
        }
      } catch (err: unknown) {
        if (isMounted) {
          setChapters([]);
          setServerError(err instanceof Error ? err.message : "Failed to load chapters");
        }
      } finally {
        if (isMounted) setLoadingChapters(false);
      }
    }
    loadChapters();
    return () => {
      isMounted = false;
    };
  }, [selectedSubjectId]);

  // Check available count whenever subject, chapter, or question type changes
  useEffect(() => {
    let isMounted = true;
    async function checkAvailability() {
      if (!selectedSubjectId) {
        setAvailableCount(null);
        return;
      }
      try {
        setCheckingAvailability(true);
        const res = await questionsApi.getAvailableCount({
          subjectId: selectedSubjectId,
          chapterId: selectedChapterId || undefined,
          type: questionType,
        });
        if (isMounted) {
          setAvailableCount(res.count);
        }
      } catch {
        if (isMounted) {
          setAvailableCount(null);
        }
      } finally {
        if (isMounted) setCheckingAvailability(false);
      }
    }
    checkAvailability();
    return () => {
      isMounted = false;
    };
  }, [selectedSubjectId, selectedChapterId, questionType]);

  // Validate form client-side
  const validateForm = (): boolean => {
    const values = {
      subject_id: selectedSubjectId,
      chapter_id: selectedChapterId || null,
      question_type_filter: questionType,
      requested_count: requestedCount,
      order_mode: orderMode,
      timer_mode: timerMode,
      timer_duration_minutes: timerMode === "FIXED" ? timerMinutes : null,
    };

    const result = quizConfigSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const fieldName = issue.path[0]?.toString() || "form";
        fieldErrors[fieldName] = issue.message;
      });
      setValidationErrors(fieldErrors);
      return false;
    }

    setValidationErrors({});
    return true;
  };

  const isCountExceeded =
    availableCount !== null && (requestedCount > availableCount || availableCount === 0);

  const isSubmitDisabled =
    submitting ||
    loadingSubjects ||
    !selectedSubjectId ||
    isCountExceeded ||
    checkingAvailability;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) return;
    if (isCountExceeded) return;

    try {
      setSubmitting(true);
      const payload = {
        subject_id: selectedSubjectId,
        chapter_id: selectedChapterId || null,
        question_type_filter: questionType,
        requested_count: requestedCount,
        order_mode: orderMode,
        timer_mode: timerMode,
        timer_duration_seconds: timerMode === "FIXED" ? timerMinutes * 60 : null,
      };

      const res = await quizApi.createQuiz(payload);
      if (res.attemptId) {
        navigate(`/attempts/${res.attemptId}`);
      }
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : "Failed to generate quiz. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const subjectSelectId = useId();
  const chapterSelectId = useId();
  const customCountInputId = useId();
  const timerDurationInputId = useId();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-indigo-400" />
          Configure New Quiz
        </h1>
        <p className="text-slate-400 mt-2 text-sm">
          Customize your study session by selecting topics, count, ordering, and timing.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">{serverError}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Card: Subject & Chapter */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm space-y-5">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <FolderTree className="w-5 h-5 text-indigo-400" /> 1. Curriculum Selection
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subject Select */}
            <div>
              <label htmlFor={subjectSelectId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Subject <span className="text-indigo-400">*</span>
              </label>
              {loadingSubjects ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading subjects...
                </div>
              ) : (
                <select
                  id={subjectSelectId}
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              )}
              {validationErrors.subject_id && (
                <p className="text-red-400 text-xs mt-1">{validationErrors.subject_id}</p>
              )}
            </div>

            {/* Chapter Select */}
            <div>
              <label htmlFor={chapterSelectId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Chapter
              </label>
              {loadingChapters ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading chapters...
                </div>
              ) : (
                <select
                  id={chapterSelectId}
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  disabled={!selectedSubjectId || chapters.length === 0}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <option value="">All Chapters</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Card: Question Type */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileQuestion className="w-5 h-5 text-indigo-400" /> 2. Question Type
          </h2>

          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { value: "BOTH", label: "Concept & PYQ (Both)" },
                { value: "CONCEPT", label: "Concept Only" },
                { value: "PYQ", label: "PYQ Only" },
              ] as const
            ).map((typeOpt) => (
              <button
                key={typeOpt.value}
                type="button"
                onClick={() => setQuestionType(typeOpt.value)}
                className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all text-center ${
                  questionType === typeOpt.value
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                }`}
              >
                {typeOpt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card: Question Count & Availability Feedback */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-400" /> 3. Question Count
            </h2>

            {/* Live Availability Indicator */}
            <div className="text-sm">
              {checkingAvailability ? (
                <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking available questions...
                </span>
              ) : availableCount !== null ? (
                isCountExceeded ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {availableCount === 0
                      ? "No questions available for this selection"
                      : `Only ${availableCount} questions available for this selection`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {availableCount} questions available
                  </span>
                )
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {[10, 20, 30].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setRequestedCount(preset);
                  setIsCustomCount(false);
                }}
                className={`py-2 px-5 rounded-xl border text-sm font-semibold transition-all ${
                  !isCustomCount && requestedCount === preset
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {preset} Questions
              </button>
            ))}

            <button
              type="button"
              onClick={() => setIsCustomCount(true)}
              className={`py-2 px-5 rounded-xl border text-sm font-semibold transition-all ${
                isCustomCount
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Custom
            </button>
          </div>

          {isCustomCount && (
            <div className="pt-2 max-w-xs">
              <label htmlFor={customCountInputId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Custom Count (1 - {MAX_QUIZ_QUESTION_COUNT})
              </label>
              <input
                id={customCountInputId}
                type="number"
                min={1}
                max={MAX_QUIZ_QUESTION_COUNT}
                value={requestedCount}
                onChange={(e) => setRequestedCount(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Maximum allowed: {MAX_QUIZ_QUESTION_COUNT} questions per quiz.
              </p>
            </div>
          )}

          {validationErrors.requested_count && (
            <p className="text-red-400 text-xs mt-1">{validationErrors.requested_count}</p>
          )}

          {isCountExceeded && (
            <p className="text-amber-400 text-xs flex items-center gap-1.5 mt-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Requested count ({requestedCount}) exceeds available active questions (
              {availableCount ?? 0}). Please decrease the count.
            </p>
          )}
        </div>

        {/* Card: Order & Timer */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Order Mode */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                <Shuffle className="w-4 h-4 text-indigo-400" /> Question Order
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "RANDOM", label: "Random" },
                    { value: "SEQUENTIAL", label: "Sequential" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setOrderMode(opt.value)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-center ${
                      orderMode === opt.value
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Mode */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-indigo-400" /> Timer Mode
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "VARIABLE", label: "Untimed / Variable" },
                    { value: "FIXED", label: "Fixed Duration" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTimerMode(opt.value)}
                    className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-center ${
                      timerMode === opt.value
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                        : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conditional Fixed Timer Input */}
          {timerMode === "FIXED" && (
            <div className="pt-2 border-t border-slate-800">
              <label htmlFor={timerDurationInputId} className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Quiz Duration (Minutes) <span className="text-indigo-400">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  id={timerDurationInputId}
                  type="number"
                  min={1}
                  max={300}
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(Number(e.target.value))}
                  className="w-36 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-400">minutes total</span>
              </div>
              {validationErrors.timer_duration_minutes && (
                <p className="text-red-400 text-xs mt-1">
                  {validationErrors.timer_duration_minutes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Submit Action */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Quiz...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Generate Quiz
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuizConfigForm;
