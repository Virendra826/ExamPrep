import React, { useState, useEffect } from "react";
import type { CandidateQuestion, CandidateOption } from "../../../types/ingestion";
import type { Subject, Chapter } from "../../../types/curriculum";
import {
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Plus,
  GraduationCap,
  Sparkles,
} from "lucide-react";

interface CandidateReviewCardProps {
  candidate: CandidateQuestion;
  index: number;
  subjects: Subject[];
  chaptersBySubject: Record<string, Chapter[]>;
  onLoadChapters: (subjectId: string) => Promise<void>;
  onUpdate: (updated: CandidateQuestion) => void;
  onDiscard: (id: string) => void;
  onCreateSubject?: (candidateId: string) => void;
  onCreateChapter?: (candidateId: string, subjectId: string) => void;
}

export const CandidateReviewCard: React.FC<CandidateReviewCardProps> = ({
  candidate,
  index,
  subjects,
  chaptersBySubject,
  onLoadChapters,
  onUpdate,
  onDiscard,
  onCreateSubject,
  onCreateChapter,
}) => {
  const [subjectId, setSubjectId] = useState(candidate.subject_id || "");
  const [chapterId, setChapterId] = useState(candidate.chapter_id || "");
  const [questionText, setQuestionText] = useState(candidate.question_text);
  const [questionType, setQuestionType] = useState(candidate.question_type);
  const [options, setOptions] = useState<CandidateOption[]>(
    candidate.options && candidate.options.length >= 2
      ? candidate.options
      : [{ text: "" }, { text: "" }]
  );
  const [correctAnswer, setCorrectAnswer] = useState(candidate.correct_answer || "");
  const [examName, setExamName] = useState(candidate.exam_name || "");
  const [examYear, setExamYear] = useState(candidate.exam_year ? String(candidate.exam_year) : "");
  const [explanation, setExplanation] = useState(candidate.explanation || "");

  // Update parent when fields change
  const propagateChanges = (
    nextState: Partial<CandidateQuestion> = {}
  ) => {
    onUpdate({
      ...candidate,
      subject_id: subjectId,
      chapter_id: chapterId,
      question_text: questionText,
      question_type: questionType,
      options,
      correct_answer: correctAnswer,
      exam_name: questionType === "PYQ" ? examName : null,
      exam_year: questionType === "PYQ" && examYear ? parseInt(examYear, 10) : null,
      explanation: explanation || null,
      ...nextState,
    });
  };

  // Keep local state in sync when candidate prop changes (e.g. bulk assign)
  useEffect(() => {
    setSubjectId(candidate.subject_id || "");
    setChapterId(candidate.chapter_id || "");
    setQuestionText(candidate.question_text);
    setQuestionType(candidate.question_type);
    setOptions(candidate.options);
    setCorrectAnswer(candidate.correct_answer || "");
    setExamName(candidate.exam_name || "");
    setExamYear(candidate.exam_year ? String(candidate.exam_year) : "");
    setExplanation(candidate.explanation || "");
  }, [candidate]);

  const handleSubjectChange = async (newSubjId: string) => {
    setSubjectId(newSubjId);
    setChapterId("");
    if (newSubjId) {
      await onLoadChapters(newSubjId);
    }
    propagateChanges({ subject_id: newSubjId, chapter_id: "" });
  };

  const handleChapterChange = (newChapId: string) => {
    setChapterId(newChapId);
    propagateChanges({ chapter_id: newChapId });
  };

  const handleOptionChange = (idx: number, newText: string) => {
    const updated = [...options];
    const prevText = updated[idx].text;
    updated[idx] = { ...updated[idx], text: newText };
    setOptions(updated);

    let nextAnswer = correctAnswer;
    if (correctAnswer === prevText || !correctAnswer) {
      nextAnswer = newText;
      setCorrectAnswer(newText);
    }
    propagateChanges({ options: updated, correct_answer: nextAnswer });
  };

  const handleAddOption = () => {
    const updated = [...options, { text: "" }];
    setOptions(updated);
    propagateChanges({ options: updated });
  };

  const handleRemoveOption = (idxToRemove: number) => {
    if (options.length <= 2) return;
    const removedText = options[idxToRemove].text;
    const updated = options.filter((_, i) => i !== idxToRemove);
    setOptions(updated);

    let nextAnswer = correctAnswer;
    if (correctAnswer === removedText) {
      nextAnswer = updated[0]?.text || "";
      setCorrectAnswer(nextAnswer);
    }
    propagateChanges({ options: updated, correct_answer: nextAnswer });
  };

  const handleSelectCorrectOption = (text: string) => {
    setCorrectAnswer(text);
    propagateChanges({ correct_answer: text });
  };

  const currentChapters = subjectId ? chaptersBySubject[subjectId] || [] : [];
  const optionLabels = ["A", "B", "C", "D", "E", "F"];

  const pageLabel =
    candidate.sourcePages && candidate.sourcePages.length > 0
      ? candidate.sourcePages.length === 1
        ? `p. ${candidate.sourcePages[0]}`
        : `pp. ${candidate.sourcePages[0]}–${candidate.sourcePages[candidate.sourcePages.length - 1]}`
      : null;

  const renderConfidenceBadge = () => {
    if (candidate.confidence === "HIGH") {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
          Ready
        </span>
      );
    }

    if (candidate.confidence === "MEDIUM" && !candidate.reviewReason) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <AlertTriangle className="w-3 h-3 mr-1 text-amber-400" />
          Review Suggested
        </span>
      );
    }

    if (candidate.confidence === "LOW" || candidate.needsReview || candidate.reviewReason) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
          <AlertTriangle className="w-3 h-3 mr-1 text-rose-400" />
          Needs Review
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
        Ready
      </span>
    );
  };

  return (
    <div
      data-testid={`candidate-card-${index}`}
      className={`rounded-2xl border p-5 transition-all shadow-lg ${
        candidate.confidence === "LOW" || candidate.reviewReason
          ? "bg-rose-950/10 border-rose-500/40 ring-1 ring-rose-500/20"
          : candidate.needsReview || candidate.confidence === "MEDIUM"
          ? "bg-amber-950/10 border-amber-500/40 ring-1 ring-amber-500/20"
          : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700/80"
      }`}
    >
      {/* Card Header Bar */}
      <div className="pb-3.5 mb-4 border-b border-slate-800/60 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 flex-wrap">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-slate-800 text-xs font-bold text-slate-300">
              #{index + 1}
            </span>
            <span className="text-sm font-semibold text-white">Extracted Candidate</span>

            {pageLabel && (
              <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-[11px] font-medium text-slate-400 border border-slate-700/60">
                {pageLabel}
              </span>
            )}

            {(candidate.extractionMethod === "GEMINI_DOCUMENT" || candidate.extractionMethod === "GEMINI_HYBRID") && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-500/10 text-[11px] font-medium text-indigo-300 border border-indigo-500/20">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-400" />
                Gemini
              </span>
            )}

            {renderConfidenceBadge()}
          </div>

          <button
            type="button"
            onClick={() => onDiscard(candidate.id)}
            aria-label={`Discard candidate ${index + 1}`}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
        </div>

        {candidate.reviewReason && (
          <div className="flex items-start space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/30 border border-rose-800/40 text-[11px] text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
            <span>{candidate.reviewReason}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Subject and Chapter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Subject <span className="text-rose-400">*</span>
              </label>
              {onCreateSubject && (
                <button
                  type="button"
                  onClick={() => onCreateSubject(candidate.id)}
                  className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 inline-flex items-center space-x-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>New</span>
                </button>
              )}
            </div>
            <select
              aria-label={`Subject for candidate ${index + 1}`}
              value={candidate.subject_id ?? subjectId}
              onChange={(e) => {
                if (e.target.value === "__create_new__") {
                  onCreateSubject?.(candidate.id);
                } else {
                  void handleSubjectChange(e.target.value);
                }
              }}
              className="block w-full px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select Subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__create_new__">+ Create new subject</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Chapter <span className="text-rose-400">*</span>
              </label>
              {onCreateChapter && (candidate.subject_id || subjectId) && (
                <button
                  type="button"
                  onClick={() => onCreateChapter(candidate.id, candidate.subject_id || subjectId)}
                  className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 inline-flex items-center space-x-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>New</span>
                </button>
              )}
            </div>
            <select
              aria-label={`Chapter for candidate ${index + 1}`}
              value={candidate.chapter_id ?? chapterId}
              onChange={(e) => {
                if (e.target.value === "__create_new__") {
                  onCreateChapter?.(candidate.id, candidate.subject_id || subjectId);
                } else {
                  handleChapterChange(e.target.value);
                }
              }}
              disabled={!(candidate.subject_id || subjectId)}
              className="block w-full px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              <option value="">
                {!(candidate.subject_id || subjectId) ? "Select subject first" : "Select Chapter..."}
              </option>
              {currentChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {subjectId && (
                <option value="__create_new__">+ Create new chapter</option>
              )}
            </select>
          </div>
        </div>

        {/* Question Type Toggle */}
        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-slate-300">Type:</span>
          <div className="flex items-center space-x-2 bg-slate-800/60 p-1 rounded-xl border border-slate-700/80 text-xs">
            <button
              type="button"
              onClick={() => {
                setQuestionType("CONCEPT");
                propagateChanges({ question_type: "CONCEPT" });
              }}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg font-medium transition-all ${
                questionType === "CONCEPT"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Concept</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setQuestionType("PYQ");
                propagateChanges({ question_type: "PYQ" });
              }}
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg font-medium transition-all ${
                questionType === "PYQ"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <GraduationCap className="w-3 h-3" />
              <span>PYQ</span>
            </button>
          </div>
        </div>

        {/* Conditional PYQ Fields */}
        {questionType === "PYQ" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Exam Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => {
                  setExamName(e.target.value);
                  propagateChanges({ exam_name: e.target.value });
                }}
                placeholder="e.g. GATE CS"
                className="block w-full px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Exam Year <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                value={examYear}
                onChange={(e) => {
                  setExamYear(e.target.value);
                  propagateChanges({
                    exam_year: e.target.value ? parseInt(e.target.value, 10) : null,
                  });
                }}
                placeholder="e.g. 2022"
                className="block w-full px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-white"
              />
            </div>
          </div>
        )}

        {/* Question Text */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Question Text <span className="text-rose-400">*</span>
          </label>
          <textarea
            rows={2}
            value={questionText}
            onChange={(e) => {
              setQuestionText(e.target.value);
              propagateChanges({ question_text: e.target.value });
            }}
            placeholder="Question content..."
            className="block w-full px-3.5 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />

          {/* Extracted Diagram / Figure Preview */}
          {(candidate.diagram_url || questionText.includes("data:image/")) && (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/70">
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-indigo-400 mb-1.5">
                <span>Associated Question Figure / Diagram</span>
              </div>
              <img
                src={
                  candidate.diagram_url ||
                  questionText.match(/!\[[^\]]*\]\((data:image\/[^;]+;base64,[^)]+)\)/)?.[1]
                }
                alt="Associated Figure"
                className="max-h-48 max-w-full object-contain rounded-lg bg-white/95 p-1.5 border border-slate-600"
              />
            </div>
          )}
        </div>

        {/* Options and Correct Answer Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300">
              Options (Click radio to mark correct answer):
            </span>
            <button
              type="button"
              onClick={handleAddOption}
              className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Option</span>
            </button>
          </div>

          <div className="space-y-2">
            {options.map((opt, optIdx) => {
              const label = optionLabels[optIdx] || `${optIdx + 1}`;
              const isCorrect = correctAnswer === opt.text && opt.text.trim().length > 0;

              return (
                <div
                  key={optIdx}
                  className={`flex items-center space-x-2 p-2 rounded-xl border text-xs transition-all ${
                    isCorrect
                      ? "bg-emerald-950/20 border-emerald-600/50"
                      : "bg-slate-800/40 border-slate-700/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectCorrectOption(opt.text)}
                    title={isCorrect ? "Correct answer" : "Mark as correct"}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-lg font-semibold transition-colors ${
                      isCorrect
                        ? "bg-emerald-500 text-slate-950"
                        : "bg-slate-800 text-slate-400 hover:text-emerald-400"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>

                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                    placeholder={`Option ${label}...`}
                    className="flex-1 px-2.5 py-1 bg-slate-900/90 border border-slate-700/80 rounded-lg text-white"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optIdx)}
                    disabled={options.length <= 2}
                    className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Explanation <span className="text-slate-500 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={explanation}
            onChange={(e) => {
              setExplanation(e.target.value);
              propagateChanges({ explanation: e.target.value });
            }}
            placeholder="Solution or concept explanation..."
            className="block w-full px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white"
          />
        </div>
      </div>
    </div>
  );
};
