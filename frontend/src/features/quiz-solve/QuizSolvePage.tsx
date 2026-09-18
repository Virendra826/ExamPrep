import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { attemptsApi } from "../../api/attempts.api";
import type {
  AttemptStateResponse,
  AttemptQuestion,
} from "../../types/attempts";
import { QuestionPalette } from "./QuestionPalette";
import { SubmitConfirmModal } from "./SubmitConfirmModal";
import { TimerWidget } from "./TimerWidget";
import { RichQuestionText } from "../../components/common/RichText";

export const QuizSolvePage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptState, setAttemptState] = useState<AttemptStateResponse | null>(null);

  // Solving State
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch Attempt and Start if CREATED
  const fetchAttemptData = useCallback(async () => {
    if (!attemptId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await attemptsApi.getAttempt(attemptId);

      // If attempt is CREATED, auto-transition to IN_PROGRESS
      if (data.attempt.status === "CREATED") {
        await attemptsApi.startAttempt(attemptId);
        data.attempt.status = "IN_PROGRESS";
      }

      setAttemptState(data);

      // Pre-fill answers for resume support
      const initialAnswers: Record<string, string> = {};
      if (data.submitted_answers && Array.isArray(data.submitted_answers)) {
        data.submitted_answers.forEach((sa) => {
          if (sa.selected_option) {
            initialAnswers[sa.quiz_question_id] = sa.selected_option;
          }
        });
      }
      setAnswers(initialAnswers);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load quiz session");
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    fetchAttemptData();
  }, [fetchAttemptData]);

  const questions: AttemptQuestion[] = attemptState?.questions || [];
  const currentQuestion: AttemptQuestion | undefined = questions[currentIndex];

  const isQuizSubmitted =
    attemptState?.attempt.status === "SUBMITTED" ||
    attemptState?.attempt.status === "EVALUATED" ||
    attemptState?.attempt.status === "TIMEOUT";

  // Auto-timeout handler when FIXED timer expires
  const handleAutoTimeout = useCallback(async () => {
    if (!attemptId || isQuizSubmitted || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await attemptsApi.timeoutAttempt(attemptId);
      navigate(`/attempts/${attemptId}/results`);
    } catch {
      try {
        await attemptsApi.submitAttempt(attemptId);
      } catch {
        // Server handles authoritative timeout
      }
      navigate(`/attempts/${attemptId}/results`);
    } finally {
      setIsSubmitting(false);
    }
  }, [attemptId, isQuizSubmitted, isSubmitting, navigate]);

  // Answer selection handler (immediate auto-save)
  const handleSelectOption = async (optionValue: string) => {
    if (!attemptId || !currentQuestion || isQuizSubmitted) return;

    // Optimistic UI update
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.quiz_question_id]: optionValue,
    }));

    try {
      setSaveStatus("saving");
      setSaveError(null);
      await attemptsApi.saveAnswer(attemptId, currentQuestion.quiz_question_id, optionValue);
      setSaveStatus("saved");
    } catch (err: unknown) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Network error: failed to save answer");
    }
  };

  // Clear current answer
  const handleClearAnswer = async () => {
    if (!attemptId || !currentQuestion || isQuizSubmitted) return;

    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.quiz_question_id];
      return copy;
    });

    try {
      setSaveStatus("saving");
      setSaveError(null);
      await attemptsApi.saveAnswer(attemptId, currentQuestion.quiz_question_id, null);
      setSaveStatus("saved");
    } catch (err: unknown) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Network error: failed to clear answer");
    }
  };

  // Final submit handler
  const handleConfirmSubmit = async () => {
    if (!attemptId) return;

    try {
      setIsSubmitting(true);
      await attemptsApi.submitAttempt(attemptId);
      setIsSubmitModalOpen(false);
      navigate(`/attempts/${attemptId}/results`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz attempt");
      setIsSubmitModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">Loading quiz session...</p>
      </div>
    );
  }

  if (error || !attemptState) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Quiz Load Error</h2>
        <p className="text-sm text-slate-400 mb-6">{error || "Unable to load quiz."}</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (isQuizSubmitted) {
    const isTimeout = attemptState.attempt.status === "TIMEOUT";
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">
          {isTimeout ? "Quiz Time Expired" : "Quiz Already Submitted"}
        </h2>
        <p className="text-slate-400 text-sm">
          {isTimeout
            ? "Your quiz session timed out and your answers have been locked and submitted."
            : "This quiz attempt has already been submitted and answers are locked."}
        </p>
        <div className="pt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate(`/attempts/${attemptId}/results`)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
          >
            View Results
          </button>
        </div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Header & Progress */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 backdrop-blur-sm mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {attemptState.quiz.subject.name}
            </span>
            {attemptState.quiz.chapter && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {attemptState.quiz.chapter.name}
              </span>
            )}
          </div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            Question {currentIndex + 1} of {totalQuestions}
          </h1>
        </div>

        {/* Progress, Timer & Submit Action */}
        <div className="flex items-center gap-4 sm:gap-6">
          {attemptState && (
            <TimerWidget
              timerMode={attemptState.quiz.timer_mode === "FIXED" ? "FIXED" : "VARIABLE"}
              initialSeconds={
                attemptState.quiz.timer_mode === "FIXED"
                  ? attemptState.serverTimeRemainingSeconds ?? (attemptState.quiz.timer_duration_seconds || 0)
                  : attemptState.serverElapsedSeconds ?? 0
              }
              onExpire={handleAutoTimeout}
              enabled={!isQuizSubmitted}
            />
          )}

          <div className="w-36 hidden md:block">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1 font-medium">
              <span>Progress</span>
              <span>
                {answeredCount}/{totalQuestions} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSubmitModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all"
          >
            <Send className="w-4 h-4" />
            Submit Quiz
          </button>
        </div>
      </div>

      {/* Main Grid: Question Area (left) + Navigation Sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Question Panel */}
        <div className="lg:col-span-3 space-y-6">
          {currentQuestion ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-sm space-y-6">
              {/* Question Header & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/40 border border-indigo-800/40 px-3 py-1 rounded-lg">
                    Q{currentIndex + 1}
                  </span>
                  <span className="text-xs font-medium text-slate-400 bg-slate-800/80 px-3 py-1 rounded-lg border border-slate-700/60">
                    {currentQuestion.question_type}
                  </span>
                  {currentQuestion.exam_name && (
                    <span className="text-xs font-medium text-amber-300 bg-amber-950/30 border border-amber-800/40 px-3 py-1 rounded-lg">
                      {currentQuestion.exam_name} {currentQuestion.exam_year}
                    </span>
                  )}
                  {currentQuestion.difficulty && (
                    <span className="text-xs font-medium text-slate-300 bg-slate-800/60 border border-slate-700/60 px-3 py-1 rounded-lg">
                      {currentQuestion.difficulty}
                    </span>
                  )}
                </div>

                {/* Auto-Save Indicator */}
                <div className="text-xs">
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      Saving answer...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Saved
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="flex items-center gap-1.5 text-red-400 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {saveError || "Failed to save"}
                    </span>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <RichQuestionText
                text={currentQuestion.question_text}
                className="text-lg font-medium text-slate-100 leading-relaxed"
              />

              {/* Options List */}
              <div className="space-y-3 pt-2">
                {currentQuestion.options.map((option, optIdx) => {
                  const optId = typeof option === "string" ? option : option.id;
                  const optText = typeof option === "string" ? option : option.text;
                  const optKey = typeof option === "string" ? option : option.id || option.text;
                  const letter = String.fromCharCode(65 + optIdx);
                  const isSelected =
                    answers[currentQuestion.quiz_question_id] === optText ||
                    (optId && answers[currentQuestion.quiz_question_id] === optId) ||
                    answers[currentQuestion.quiz_question_id] === letter;

                  return (
                    <button
                      key={optKey}
                      type="button"
                      onClick={() => handleSelectOption(optText)}
                      className={`w-full text-left p-4 rounded-xl border text-sm font-medium transition-all flex items-start gap-3.5 ${
                        isSelected
                          ? "bg-indigo-600/15 border-indigo-500 text-white ring-1 ring-indigo-500 shadow-md shadow-indigo-600/10"
                          : "bg-slate-800/60 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-lg border text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-slate-900 border-slate-700 text-slate-400"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="mt-1 leading-relaxed">{optText}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action Controls & Navigation */}
              <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>

                  {answers[currentQuestion.quiz_question_id] && (
                    <button
                      type="button"
                      onClick={handleClearAnswer}
                      className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Clear Choice
                    </button>
                  )}
                </div>

                <div>
                  {currentIndex < totalQuestions - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSubmitModalOpen(true)}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition-all"
                    >
                      Review & Submit <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">No questions available.</div>
          )}
        </div>

        {/* Question Palette Sidebar */}
        <div className="lg:col-span-1">
          <QuestionPalette
            questions={questions}
            currentIndex={currentIndex}
            answers={answers}
            onSelectQuestion={(idx) => setCurrentIndex(idx)}
          />
        </div>
      </div>

      {/* Confirmation Modal */}
      <SubmitConfirmModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={handleConfirmSubmit}
        isSubmitting={isSubmitting}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        unansweredCount={unansweredCount}
      />
    </div>
  );
};

export default QuizSolvePage;
