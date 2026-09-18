import React, { useState, useRef } from "react";
import { ingestionApi } from "../../../api/ingestion.api";
import { IngestionReviewView } from "./IngestionReviewView";
import type { IngestionBatch, CandidateQuestion } from "../../../types/ingestion";
import {
  UploadCloud,
  FileText,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface PdfUploadViewProps {
  onNavigateToQuestions: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const PdfUploadView: React.FC<PdfUploadViewProps> = ({ onNavigateToQuestions }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Extracted batch state
  const [batch, setBatch] = useState<IngestionBatch | null>(null);
  const [candidates, setCandidates] = useState<CandidateQuestion[]>([]);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    setFileError(null);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setFileError("Invalid file type: only PDF documents (.pdf) are supported.");
      return false;
    }
    if (file.size === 0) {
      setFileError("The selected file is empty (0 bytes).");
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File size exceeds the 10MB maximum upload limit.");
      return false;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateFile(file)) {
        setSelectedFile(file);
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (validateFile(file)) {
        setSelectedFile(file);
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setFileError(null);
    setFailedMessage(null);
    setUploadProgress(30);

    try {
      setUploadProgress(60);
      const res = await ingestionApi.uploadPdf(selectedFile);
      setUploadProgress(100);

      if (res.batch.status === "FAILED") {
        setBatch(res.batch);
        setFailedMessage(
          res.batch.error_message || "PDF extraction failed. Please ensure the PDF is valid."
        );
      } else {
        setBatch(res.batch);
        setCandidates(res.candidates);
      }
    } catch (err: any) {
      setFileError(err?.message || "Failed to upload and extract PDF.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileError(null);
    setFailedMessage(null);
    setBatch(null);
    setCandidates([]);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // If extraction succeeded and batch is EXTRACTED, render candidate review view
  if (batch && batch.status === "EXTRACTED") {
    return (
      <IngestionReviewView
        batch={batch}
        initialCandidates={candidates}
        onFinishReview={() => {
          handleReset();
          onNavigateToQuestions();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">PDF Question Ingestion</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Upload exam papers, notes, or quiz PDFs. Automated heuristic algorithms extract questions
          for administrator verification before publication.
        </p>
      </div>

      {/* Upload Box / Drag & Drop Area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all bg-slate-900/40 ${
          fileError
            ? "border-rose-500/50 bg-rose-950/10"
            : selectedFile
            ? "border-indigo-500/60 bg-indigo-950/10"
            : "border-slate-800 hover:border-slate-700"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          id="pdf-file-upload"
          data-testid="pdf-file-input"
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">
              {selectedFile ? selectedFile.name : "Select or drag & drop PDF here"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Supported formats: .pdf (Max size 10MB). Text-based PDFs produce best results.
            </p>
          </div>

          {selectedFile && (
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span className="font-medium">{selectedFile.name}</span>
              <span className="text-slate-400">
                ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <label
              htmlFor="pdf-file-upload"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors border border-slate-700"
            >
              Browse PDF
            </label>

            {selectedFile && !isUploading && !failedMessage && (
              <button
                type="button"
                onClick={handleUpload}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center space-x-1.5"
              >
                <span>Upload & Extract</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Uploading Progress */}
      {isUploading && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Analyzing and extracting questions from PDF...</span>
            </span>
            <span className="text-slate-400">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Extraction Failure Alert Card */}
      {failedMessage && (
        <div
          role="alert"
          className="p-6 rounded-2xl bg-rose-950/20 border border-rose-800/60 text-rose-300 space-y-3"
        >
          <div className="flex items-center space-x-2 font-bold text-sm text-rose-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>PDF Extraction Failed</span>
          </div>
          <p className="text-xs text-rose-300/90 leading-relaxed">{failedMessage}</p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-800 text-xs font-semibold rounded-xl transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Another PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* Client Validation Error */}
      {fileError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Pipeline Help & Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-indigo-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>1. Text Extraction</span>
          </div>
          <p className="text-[11px] text-slate-400">
            PDF text is parsed and inspected for questions, multiple-choice options, and answer keys.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>2. Admin Verification</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Questions flagged as incomplete or missing answers are reviewed and corrected by an
            admin.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400">
            <FileText className="w-4 h-4" />
            <span>3. Bank Publication</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Approved questions are assigned to subjects & chapters and committed to the question
            bank.
          </p>
        </div>
      </div>
    </div>
  );
};
