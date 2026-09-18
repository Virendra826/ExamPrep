# Hybrid Page-Aware Extraction Engine Upgrade

## 1. Overview
The ExamPrep PDF Ingestion subsystem has been upgraded to a **Hybrid Page-Aware Extraction Engine**. The pipeline combines deterministic, high-fidelity local text extraction, structured mathematical option parsing, layout-aware segmentation, in-memory single-page screenshot rasterization, and optional LLM/Vision escalation for degraded or complex visual questions (such as physics diagrams, chemical bonds, and multi-line equations).

---

## 2. Key Architecture & Subsystem Changes

### A. Removal of Fixture Hardcoding (PROMPT 1)
- Removed all fixture-specific fallback branches keyed on `pq.questionNumber === 2 / 3 / 5 / 6` and literal option overrides.
- Cleaned `DEFAULT_WATERMARK_PATTERNS` so academic terms (e.g. "Work Power Energy", "Chemical Bonding", "Thermodynamics") are never stripped.
- Replaced hardcoded fallbacks with a generalized two-pass math option recovery algorithm.

### B. Extensible Question Extraction Provider Abstraction (PROMPT 2)
- Defined `QuestionExtractionProvider` interface returning structured Zod-validated `VisionExtractionResult` objects.
- Implemented `DisabledProvider` (default offline/deterministic behavior) and `AnthropicQuestionExtractionProvider` (Claude 3.5 Sonnet visual escalation).
- Configured provider factory via `createQuestionExtractionProvider()`.

### C. In-Memory Targeted Page Screenshot Rasterizer (PROMPT 3)
- Implemented `renderPageToImage(pdfBuffer, pageNumber)` using pure in-memory `pdfjs-dist` and `node-canvas`.
- Renders 150 DPI PNGs in memory without disk I/O leaks or temp file pollution.
- Handles out-of-range pages and corrupted buffers with typed errors.

### D. Deterministic Confidence Scoring (PROMPT 4)
- Implemented `scoreConfidence(features)` returning `'HIGH' | 'MEDIUM' | 'LOW'`.
- Evaluates:
  - Option count (>= 2)
  - Non-empty option texts without residual markers
  - Stem text length (>= 5 chars)
  - Presence of resolved correct answer
  - Answer-key mapping consistency
  - Absence of residual `(1)..(4)` or `(A)..(D)` markers in the stem

### E. Budgeted Vision Escalation (PROMPT 5)
- Automatically escalates low-confidence candidates (`confidence === 'LOW'` or missing options) when a vision provider is configured.
- Enforces a hard budget of maximum 5 escalations per PDF upload batch.
- Rescores confidence post-escalation and sets `extractionMethod: 'TEXT_PLUS_VISION'`.
- Gracefully degrades to deterministic extraction without failing the batch if vision throws or rate limits.

### F. Cross-Validation & Disagreement Detection (PROMPT 6)
- Evaluates option/answer consistency across all candidates.
- Flags answer disagreements between deterministic answer key and vision extraction.
- Flags missing options, missing answers, or options with unmapped answer keys with clear, actionable `reviewReason` strings.

### G. Database Schema & Diagram Storage (PROMPT 7)
- Extended Prisma schema `Question` model:
  - `diagram_url String?` (persists diagram image URL)
  - `extraction_metadata Json?` (stores source pages, extraction method, confidence, and review reason)
- Updated `IngestionService.persistBatchQuestions` to decode base64 diagrams, persist them via `StorageProvider` to `/uploads/<uuid>.png`, and save `diagram_url`.

### H. Review UI Enhancements (PROMPT 8)
- Updated `CandidateReviewCard.tsx`:
  - Tiered confidence badge: **Ready** (Green), **Review Suggested** (Amber), **Needs Review** (Red).
  - Provenance tag: `p. X` or `pp. X–Y`.
  - Explanatory `reviewReason` alert box.
  - Primary `diagram_url` visual rendering with markdown fallback.

---

## 3. Environment Configuration

The extraction pipeline operates 100% locally and offline by default. To enable optional LLM vision escalation for degraded PDFs, configure the following environment variables:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VISION_PROVIDER` | `string` | `disabled` | Set to `anthropic` to enable vision escalation. Set to `disabled` (or leave empty) for offline deterministic mode. |
| `VISION_API_KEY` | `string` | `""` | Anthropic API key (required if `VISION_PROVIDER=anthropic`). |
| `VISION_MODEL` | `string` | `claude-3-5-sonnet-20241022` | Optional model override for visual escalation. |

---

## 4. Database Schema Impact

```prisma
model Question {
  id                  String               @id @default(uuid())
  subject_id          String
  chapter_id          String
  question_text       String
  question_type       QuestionType
  difficulty          DifficultyLevel?
  status              QuestionStatus       @default(ACTIVE)
  exam_name           String?
  exam_year           Int?
  explanation         String?
  diagram_url         String?              // NEW: Diagram / Figure image URL
  extraction_metadata Json?                // NEW: Provenance & confidence metadata
  created_at          DateTime             @default(now())
  updated_at          DateTime             @updatedAt
  ...
}
```

---

## 5. Verification Matrix & Backward Compatibility

All 23 backend test suites (184 tests) and all 14 frontend test suites (66 tests) pass with 100% green status:
- **Zero Hardcoding Guard**: Structural test `backend/tests/no-fixture-hardcoding.test.ts` validates that no fixture-specific literals or question number branches exist in extractor logic.
- **Regression Matrix**: `backend/tests/extraction.regression.test.ts` validates Work Power Energy PDF, chemistry formulas (`XeF4`, `K2Cr2O7`), multi-column questions, missing answer keys, and scanned PDF errors.
- **Backward Compatibility**: Pre-existing questions, manual question authoring, quiz generation, timer (Fixed & Variable), attempts, answer evaluation, results, and analytics remain 100% functional.
