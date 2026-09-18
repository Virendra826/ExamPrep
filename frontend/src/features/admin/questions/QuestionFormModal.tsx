import React, { useState, useEffect, useCallback } from "react";
import { Modal } from "../../../components/common/Modal";
import { questionFormSchema } from "../../../validation/questions";
import { subjectsApi } from "../../../api/subjects.api";
import { chaptersApi } from "../../../api/chapters.api";
import { ApiError } from "../../../api/apiClient";
import type { Question, QuestionOption, QuestionType, Difficulty, QuestionStatus } from "../../../types/questions";
import type { Subject, Chapter } from "../../../types/curriculum";
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    question_text: string;
    options: QuestionOption[];
    correct_answer: string;
    subject_id: string;
    chapter_id: string;
    question_type: QuestionType;
    difficulty?: Difficulty | null;
    status?: QuestionStatus;
    exam_name?: string | null;
    exam_year?: number | null;
    explanation?: string | null;
  }) => Promise<void>;
  initialQuestion?: Question | null;
  defaultSubjectId?: string;
  defaultChapterId?: string;
}

export const QuestionFormModal: React.FC<QuestionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialQuestion,
  defaultSubjectId,
  defaultChapterId,
}) => {
  const isEditing = !!initialQuestion;

  // Subjects & Chapters cascading state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);

  // Form fields
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("CONCEPT");
  const [options, setOptions] = useState<QuestionOption[]>([
    { text: "" },
    { text: "" },
  ]);
  const [selectedCorrectOptionIndex, setSelectedCorrectOptionIndex] = useState<number>(0);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [examName, setExamName] = useState("");
  const [examYear, setExamYear] = useState<string>("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [status, setStatus] = useState<QuestionStatus>("DRAFT");
  const [explanation, setExplanation] = useState("");

  // Validation & Error states
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch subjects on modal open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadSubjects = async () => {
      setIsLoadingSubjects(true);
      try {
        const res = await subjectsApi.getSubjects({ limit: 100, includeInactive: false });
        if (isMounted) {
          setSubjects(res.data);
        }
      } catch (err: unknown) {
        console.error("Failed to fetch subjects:", err);
      } finally {
        if (isMounted) setIsLoadingSubjects(false);
      }
    };

    void loadSubjects();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Fetch chapters whenever subjectId changes
  const fetchChaptersForSubject = useCallback(async (selectedSubjId: string) => {
    if (!selectedSubjId) {
      setChapters([]);
      return;
    }
    setIsLoadingChapters(true);
    try {
      const res = await chaptersApi.getChaptersBySubject(selectedSubjId, {
        limit: 100,
        includeInactive: false,
      });
      setChapters(res.data);
    } catch (err: unknown) {
      console.error("Failed to load chapters for subject:", err);
      setChapters([]);
    } finally {
      setIsLoadingChapters(false);
    }
  }, []);

  // Initialize or reset form state
  useEffect(() => {
    if (!isOpen) return;

    if (initialQuestion) {
      setSubjectId(initialQuestion.subject_id);
      void fetchChaptersForSubject(initialQuestion.subject_id);
      setChapterId(initialQuestion.chapter_id);
      setQuestionText(initialQuestion.question_text);
      setQuestionType(initialQuestion.question_type);
      setOptions(
        initialQuestion.options && initialQuestion.options.length >= 2
          ? initialQuestion.options.map((opt) => ({ id: opt.id, text: opt.text }))
          : [{ text: "" }, { text: "" }]
      );
      setCorrectAnswer(initialQuestion.correct_answer || "");

      // Match correct answer index
      const matchedIdx = initialQuestion.options.findIndex(
        (o) => (o.id && o.id === initialQuestion.correct_answer) || o.text === initialQuestion.correct_answer
      );
      setSelectedCorrectOptionIndex(matchedIdx >= 0 ? matchedIdx : 0);

      setExamName(initialQuestion.exam_name || "");
      setExamYear(initialQuestion.exam_year ? String(initialQuestion.exam_year) : "");
      setDifficulty(initialQuestion.difficulty || "");
      setStatus(initialQuestion.status);
      setExplanation(initialQuestion.explanation || "");
    } else {
      const initialSubj = defaultSubjectId || "";
      setSubjectId(initialSubj);
      if (initialSubj) {
        void fetchChaptersForSubject(initialSubj);
      } else {
        setChapters([]);
      }
      setChapterId(defaultChapterId || "");
      setQuestionText("");
      setQuestionType("CONCEPT");
      setOptions([
        { text: "" },
        { text: "" },
      ]);
      setSelectedCorrectOptionIndex(0);
      setCorrectAnswer("");
      setExamName("");
      setExamYear("");
      setDifficulty("");
      setStatus("DRAFT");
      setExplanation("");
    }

    setFieldErrors({});
    setServerError(null);
  }, [isOpen, initialQuestion, defaultSubjectId, defaultChapterId, fetchChaptersForSubject]);


  // Handle subject change (cascading)
  const handleSubjectChange = (newSubjectId: string) => {
    setSubjectId(newSubjectId);
    setChapterId("");
    if (newSubjectId) {
      void fetchChaptersForSubject(newSubjectId);
    } else {
      setChapters([]);
    }
  };

  // Option management
  const handleOptionTextChange = (index: number, newText: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], text: newText };
    setOptions(updated);

    if (index === selectedCorrectOptionIndex) {
      setCorrectAnswer(updated[index].id || newText);
    }
  };

  const handleAddOption = () => {
    setOptions([...options, { text: "" }]);
  };

  const handleRemoveOption = (indexToRemove: number) => {
    if (options.length <= 2) return; // Keep at least 2 options
    const updated = options.filter((_, idx) => idx !== indexToRemove);
    setOptions(updated);

    if (selectedCorrectOptionIndex === indexToRemove) {
      setSelectedCorrectOptionIndex(0);
      if (updated[0]) setCorrectAnswer(updated[0].id || updated[0].text);
    } else if (selectedCorrectOptionIndex > indexToRemove) {
      setSelectedCorrectOptionIndex(selectedCorrectOptionIndex - 1);
    }
  };

  const handleSelectCorrectOption = (index: number) => {
    setSelectedCorrectOptionIndex(index);
    if (options[index]) {
      setCorrectAnswer(options[index].id || options[index].text);
    }
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);

    // Compute effective correct answer string
    const targetOption = options[selectedCorrectOptionIndex];
    const resolvedCorrectAnswer = (targetOption?.id || targetOption?.text || correctAnswer).trim();

    const rawPayload = {
      question_text: questionText.trim(),
      options: options.map((opt) => ({
        ...(opt.id ? { id: opt.id } : {}),
        text: opt.text.trim(),
      })),
      correct_answer: resolvedCorrectAnswer,
      subject_id: subjectId,
      chapter_id: chapterId,
      question_type: questionType,
      difficulty: difficulty || null,
      status,
      exam_name: questionType === "PYQ" ? examName.trim() || null : null,
      exam_year: questionType === "PYQ" && examYear ? parseInt(examYear, 10) : null,
      explanation: explanation.trim() || null,
    };

    const validationResult = questionFormSchema.safeParse(rawPayload);

    if (!validationResult.success) {
      const errMap: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path.join(".");
        if (!errMap[path]) {
          errMap[path] = issue.message;
        }
      });
      setFieldErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(validationResult.data);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("An unexpected error occurred while saving the question.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Question" : "Create New Question"}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {serverError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center space-x-2.5"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{serverError}</span>
          </div>
        )}

        {/* Taxonomy Cascading Select: Subject -> Chapter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="question-subject"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1"
            >
              Subject <span className="text-rose-400">*</span>
            </label>
            <select
              id="question-subject"
              value={subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={isLoadingSubjects}
              className={`block w-full px-3.5 py-2 bg-slate-800/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                fieldErrors.subject_id
                  ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20"
                  : "border-slate-700/80 focus:border-indigo-500 focus:ring-indigo-500/20"
              }`}
            >
              <option value="">Select a Subject...</option>
              {subjects.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {subj.name}
                </option>
              ))}
            </select>
            {fieldErrors.subject_id && (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {fieldErrors.subject_id}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="question-chapter"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1"
            >
              Chapter <span className="text-rose-400">*</span>
            </label>
            <select
              id="question-chapter"
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              disabled={!subjectId || isLoadingChapters}
              className={`block w-full px-3.5 py-2 bg-slate-800/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all disabled:opacity-50 ${
                fieldErrors.chapter_id
                  ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20"
                  : "border-slate-700/80 focus:border-indigo-500 focus:ring-indigo-500/20"
              }`}
            >
              <option value="">
                {!subjectId
                  ? "First select a subject"
                  : isLoadingChapters
                  ? "Loading chapters..."
                  : chapters.length === 0
                  ? "No chapters available"
                  : "Select a Chapter..."}
              </option>
              {chapters.map((chap) => (
                <option key={chap.id} value={chap.id}>
                  {chap.name}
                </option>
              ))}
            </select>
            {fieldErrors.chapter_id && (
              <p className="mt-1 text-xs text-rose-400" role="alert">
                {fieldErrors.chapter_id}
              </p>
            )}
          </div>
        </div>

        {/* Question Type Radio & Difficulty & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Question Type */}
          <div>
            <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Question Type <span className="text-rose-400">*</span>
            </span>
            <div className="flex items-center space-x-3 bg-slate-800/60 p-1.5 rounded-xl border border-slate-700/80">
              <label
                className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  questionType === "CONCEPT"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <input
                  type="radio"
                  name="question_type"
                  value="CONCEPT"
                  checked={questionType === "CONCEPT"}
                  onChange={() => setQuestionType("CONCEPT")}
                  className="sr-only"
                />
                <span>Concept</span>
              </label>

              <label
                className={`flex-1 flex items-center justify-center py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  questionType === "PYQ"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <input
                  type="radio"
                  name="question_type"
                  value="PYQ"
                  checked={questionType === "PYQ"}
                  onChange={() => setQuestionType("PYQ")}
                  className="sr-only"
                />
                <span>PYQ</span>
              </label>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label
              htmlFor="question-difficulty"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Difficulty <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <select
              id="question-difficulty"
              value={difficulty || ""}
              onChange={(e) => setDifficulty((e.target.value as Difficulty) || "")}
              className="block w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Unspecified</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label
              htmlFor="question-status"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Initial Status
            </label>
            <select
              id="question-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as QuestionStatus)}
              className="block w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="DRAFT">Draft (Under Review)</option>
              <option value="ACTIVE">Active (Live in Bank)</option>
              {isEditing && <option value="INACTIVE">Inactive</option>}
            </select>
          </div>
        </div>

        {/* Conditional PYQ Fields */}
        {questionType === "PYQ" && (
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Previous Year Question (PYQ) Exam Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="exam-name"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Exam Name <span className="text-rose-400">*</span>
                </label>
                <input
                  id="exam-name"
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g. GATE Computer Science"
                  className={`block w-full px-3 py-2 bg-slate-900 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    fieldErrors.exam_name
                      ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-700/80 focus:border-amber-500 focus:ring-amber-500/20"
                  }`}
                />
                {fieldErrors.exam_name && (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {fieldErrors.exam_name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="exam-year"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Exam Year <span className="text-rose-400">*</span>
                </label>
                <input
                  id="exam-year"
                  type="number"
                  min="1950"
                  max="2100"
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value)}
                  placeholder="e.g. 2023"
                  className={`block w-full px-3 py-2 bg-slate-900 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                    fieldErrors.exam_year
                      ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-700/80 focus:border-amber-500 focus:ring-amber-500/20"
                  }`}
                />
                {fieldErrors.exam_year && (
                  <p className="mt-1 text-xs text-rose-400" role="alert">
                    {fieldErrors.exam_year}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Question Text */}
        <div>
          <label
            htmlFor="question-text"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1"
          >
            Question Text <span className="text-rose-400">*</span>
          </label>
          <textarea
            id="question-text"
            rows={3}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Type or paste question stem here..."
            className={`block w-full px-3.5 py-2.5 bg-slate-800/80 border rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
              fieldErrors.question_text
                ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20"
                : "border-slate-700/80 focus:border-indigo-500 focus:ring-indigo-500/20"
            }`}
          />
          {fieldErrors.question_text && (
            <p className="mt-1 text-xs text-rose-400" role="alert">
              {fieldErrors.question_text}
            </p>
          )}
        </div>

        {/* Dynamic Options List with Correct Answer Radio */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Answer Choices <span className="text-rose-400">*</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Mark one option as the authoritative correct answer. Minimum 2 options required.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddOption}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 hover:bg-indigo-950/70 border border-indigo-800/50 rounded-lg transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Option</span>
            </button>
          </div>

          {fieldErrors.options && (
            <p className="text-xs text-rose-400" role="alert">
              {fieldErrors.options}
            </p>
          )}

          <div className="space-y-2.5">
            {options.map((option, idx) => {
              const isCorrect = selectedCorrectOptionIndex === idx;
              const optionLabel = optionLabels[idx] || `${idx + 1}`;
              const optionFieldError = fieldErrors[`options.${idx}.text`];

              return (
                <div
                  key={idx}
                  className={`flex items-center space-x-3 p-2.5 rounded-xl border transition-all ${
                    isCorrect
                      ? "bg-emerald-950/20 border-emerald-600/50 ring-1 ring-emerald-500/30"
                      : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                  }`}
                >
                  {/* Correct Answer Radio Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectCorrectOption(idx)}
                    aria-label={isCorrect ? `Option ${optionLabel} is correct answer` : `Mark option ${optionLabel} as correct`}
                    title={isCorrect ? "Correct answer selected" : "Click to mark as correct answer"}
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                      isCorrect
                        ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                        : "bg-slate-800 text-slate-400 hover:text-emerald-400 hover:bg-slate-700"
                    }`}
                  >
                    <CheckCircle2 className={`w-3.5 h-3.5 ${isCorrect ? "fill-current" : ""}`} />
                    <span>{isCorrect ? "Correct" : optionLabel}</span>
                  </button>

                  {/* Option Text Input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      aria-label={`Option ${optionLabel} text`}
                      value={option.text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      placeholder={`Choice ${optionLabel}...`}
                      className={`block w-full px-3 py-1.5 bg-slate-900/90 border rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                        optionFieldError
                          ? "border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-700/80 focus:border-indigo-500 focus:ring-indigo-500/20"
                      }`}
                    />
                    {optionFieldError && (
                      <p className="mt-1 text-[11px] text-rose-400" role="alert">
                        {optionFieldError}
                      </p>
                    )}
                  </div>

                  {/* Remove Option Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    disabled={options.length <= 2}
                    aria-label={`Remove option ${optionLabel}`}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {fieldErrors.correct_answer && (
            <p className="text-xs text-rose-400" role="alert">
              {fieldErrors.correct_answer}
            </p>
          )}
        </div>

        {/* Explanation Textarea */}
        <div>
          <label
            htmlFor="question-explanation"
            className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center space-x-1.5"
          >
            <span>Explanation & Rationale</span>
            <span className="text-slate-500 font-normal">(shown post-evaluation)</span>
          </label>
          <textarea
            id="question-explanation"
            rows={2}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain why the correct option is true and clarify common student misconceptions..."
            className="block w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center space-x-1.5 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 disabled:opacity-60 transition-all"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            <span>{isEditing ? "Save Question" : "Create Question"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
