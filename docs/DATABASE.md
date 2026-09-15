# Database Architecture & Data Model

This document outlines the ExamPrep database schema, entity relationships, cascade behaviors, and the core historical-consistency decisions that govern the platform.

---

## 1. Historical-Consistency Decision

> **Architectural Invariant:**
> 1. **Questions are NEVER hard-deleted.**
> 2. **Edits to questions are performed in-place.**
> 3. **Scoring and evaluation metrics are permanently frozen at evaluation time.**
>
> *Do not deviate from this documented decision without a formal architecture-change proposal.*

### Rationale
- **Auditability & Integrity**: Once a student attempts a quiz, the attempt (`QuizAttempt`), the answers submitted (`SubmittedAnswer`), and the computed score (`Result`) must reflect what the user actually saw and answered at that moment in time.
- **Soft Deletion / Deprecation**: If a question is defective, outdated, or duplicated, administrators transition its `status` enum to `INACTIVE`. This prevents it from appearing in any newly generated quizzes, while preserving all existing `QuizQuestion` references and past student performance records.
- **Evaluation Snapshot**: The `Result` table stores snapshot values for `total_questions`, `attempted_count`, `correct_count`, `incorrect_count`, `marks_obtained`, `percentage`, and `accuracy`. Even if a question's options or answer key are modified in the future, past results are never retroactively modified or recalculated.

---

## 2. Enums

| Enum | Allowed Values | Purpose |
|---|---|---|
| `Role` | `STUDENT`, `ADMIN` | User authorization role |
| `QuestionType` | `CONCEPT`, `PYQ` | Conceptual question vs Previous Year Question |
| `QuestionSource` | `PDF`, `MANUAL` | Ingestion origin of question/batch |
| `Difficulty` | `EASY`, `MEDIUM`, `HARD` | Question difficulty level |
| `QuestionStatus` | `DRAFT`, `ACTIVE`, `INACTIVE` | Lifecycle status (`DRAFT` on ingest, `ACTIVE` once verified, `INACTIVE` when retired) |
| `IngestionStatus` | `UPLOADED`, `EXTRACTING`, `EXTRACTED`, `FAILED`, `REVIEWED` | Processing state of bulk question uploads |
| `QuestionTypeFilter` | `CONCEPT`, `PYQ`, `BOTH` | Quiz generator question type criteria |
| `OrderMode` | `SEQUENTIAL`, `RANDOM` | Question display order for quiz session |
| `TimerMode` | `FIXED`, `VARIABLE` | Quiz timer mode |
| `AttemptStatus` | `CREATED`, `STARTED`, `IN_PROGRESS`, `TIMEOUT`, `SUBMITTED`, `EVALUATED` | Lifecycle state of a student's quiz session |

---

## 3. Entity Catalog

### 3.1 `User` (`users`)
Represents students and platform administrators.
- `id` (UUID, PK)
- `email` (String, Unique)
- `password_hash` (String)
- `name` (String)
- `role` (Enum `Role`)
- `is_active` (Boolean, default `true`)
- `created_at` (DateTime, default `now()`)
- `updated_at` (DateTime, auto-updated)

### 3.2 `RefreshToken` (`refresh_tokens`)
JWT refresh token storage for session revocation.
- `id` (UUID, PK)
- `user_id` (UUID, FK -> `User.id`, `onDelete: Cascade`)
- `token_hash` (String)
- `expires_at` (DateTime)
- `revoked_at` (DateTime, nullable)
- `created_at` (DateTime, default `now()`)

### 3.3 `Subject` (`subjects`)
Academic subject taxonomy (e.g., Mathematics, Physics).
- `id` (UUID, PK)
- `name` (String, Unique)
- `description` (String, nullable)
- `is_active` (Boolean, default `true`)
- `created_at` (DateTime, default `now()`)
- `updated_at` (DateTime, auto-updated)

### 3.4 `Chapter` (`chapters`)
Subject chapter taxonomy (e.g., Calculus, Thermodynamics).
- `id` (UUID, PK)
- `subject_id` (UUID, FK -> `Subject.id`, `onDelete: Restrict`)
- `name` (String)
- `description` (String, nullable)
- `is_active` (Boolean, default `true`)
- `created_at` (DateTime, default `now()`)
- `updated_at` (DateTime, auto-updated)
- **Constraints**: `@@unique([subject_id, name])`

### 3.5 `Question` (`questions`)
Individual multiple-choice question bank.
- `id` (UUID, PK)
- `question_text` (String)
- `options` (JSON, contains option keys and text)
- `correct_answer` (String, option key like "A", "B", etc.)
- `explanation` (String, nullable)
- `subject_id` (UUID, FK -> `Subject.id`, `onDelete: Restrict`)
- `chapter_id` (UUID, FK -> `Chapter.id`, `onDelete: Restrict`)
- `question_type` (Enum `QuestionType`)
- `source` (Enum `QuestionSource`)
- `exam_name` (String, nullable)
- `exam_year` (Int, nullable)
- `difficulty` (Enum `Difficulty`, nullable)
- `status` (Enum `QuestionStatus`, default `DRAFT`)
- `ingestion_batch_id` (UUID, nullable, FK -> `IngestionBatch.id`, `onDelete: SetNull`)
- `created_by` (UUID, FK -> `User.id`, `onDelete: Restrict`)
- `created_at` (DateTime, default `now()`)
- `updated_at` (DateTime, auto-updated)
- **Indexes**: `@@index([subject_id, chapter_id, question_type, status])`

### 3.6 `IngestionBatch` (`ingestion_batches`)
Tracks bulk question uploads (e.g., extracted from PDF or manual files).
- `id` (UUID, PK)
- `uploaded_by` (UUID, FK -> `User.id`, `onDelete: Restrict`)
- `source_type` (Enum `QuestionSource`)
- `original_filename` (String)
- `storage_key` (String, nullable)
- `status` (Enum `IngestionStatus`)
- `error_message` (String, nullable)
- `created_at` (DateTime, default `now()`)
- `updated_at` (DateTime, auto-updated)

### 3.7 `Quiz` (`quizzes`)
Quiz configuration template generated by students or teachers.
- `id` (UUID, PK)
- `created_by_user_id` (UUID, FK -> `User.id`, `onDelete: Restrict`)
- `subject_id` (UUID, FK -> `Subject.id`, `onDelete: Restrict`)
- `chapter_id` (UUID, nullable, FK -> `Chapter.id`, `onDelete: Restrict`)
- `question_type_filter` (Enum `QuestionTypeFilter`)
- `requested_count` (Int)
- `order_mode` (Enum `OrderMode`)
- `timer_mode` (Enum `TimerMode`)
- `timer_duration_seconds` (Int, nullable)
- `created_at` (DateTime, default `now()`)

### 3.8 `QuizQuestion` (`quiz_questions`)
Ordered mapping of questions assigned to a specific quiz.
- `id` (UUID, PK)
- `quiz_id` (UUID, FK -> `Quiz.id`, `onDelete: Cascade`)
- `question_id` (UUID, FK -> `Question.id`, `onDelete: Restrict`)
- `display_order` (Int)
- **Constraints**:
  - `@@unique([quiz_id, question_id])`
  - `@@unique([quiz_id, display_order])`

### 3.9 `QuizAttempt` (`quiz_attempts`)
A student's session taking a quiz.
- `id` (UUID, PK)
- `quiz_id` (UUID, FK -> `Quiz.id`, `onDelete: Restrict`)
- `user_id` (UUID, FK -> `User.id`, `onDelete: Restrict`)
- `status` (Enum `AttemptStatus`)
- `started_at` (DateTime, nullable)
- `submitted_at` (DateTime, nullable)
- `time_taken_seconds` (Int, nullable)
- `created_at` (DateTime, default `now()`)
- `updated_at` (DateTime, auto-updated)

### 3.10 `SubmittedAnswer` (`submitted_answers`)
An individual question answered within an attempt.
- `id` (UUID, PK)
- `attempt_id` (UUID, FK -> `QuizAttempt.id`, `onDelete: Cascade`)
- `quiz_question_id` (UUID, FK -> `QuizQuestion.id`, `onDelete: Restrict`)
- `selected_option` (String, nullable)
- `is_correct` (Boolean, nullable)
- `answered_at` (DateTime, nullable)
- `created_at` (DateTime, default `now()`)
- **Constraints**: `@@unique([attempt_id, quiz_question_id])`

### 3.11 `Result` (`results`)
Evaluation results and scoring frozen upon quiz submission.
- `id` (UUID, PK)
- `attempt_id` (UUID, Unique, FK -> `QuizAttempt.id`, `onDelete: Cascade`)
- `total_questions` (Int)
- `attempted_count` (Int)
- `correct_count` (Int)
- `incorrect_count` (Int)
- `unattempted_count` (Int)
- `marks_obtained` (Float)
- `total_marks` (Float)
- `percentage` (Float)
- `accuracy` (Float)
- `time_taken_seconds` (Int)
- `evaluated_at` (DateTime, default `now()`)

---

## 4. Foreign Key Constraints & Cascade Semantics

- **Cascade Delete (`onDelete: Cascade`)**:
  - `User -> RefreshToken`: Deleting a user cleans up active refresh tokens.
  - `Quiz -> QuizQuestion`: Deleting a quiz template removes its question mapping entries.
  - `QuizAttempt -> SubmittedAnswer`: Deleting an attempt purges answer rows for that attempt.
  - `QuizAttempt -> Result`: Deleting an attempt removes its result snapshot.

- **Restricted Delete (`onDelete: Restrict`)**:
  - `Subject -> Chapter`: Cannot delete a subject with existing chapters.
  - `Subject / Chapter -> Question`: Cannot delete taxonomy with associated questions.
  - `Question -> QuizQuestion`: Cannot delete questions referenced by any past or existing quizzes.
  - `Quiz -> QuizAttempt`: Cannot delete a quiz template that has user attempts.
  - `User -> Quiz / QuizAttempt / Question / IngestionBatch`: Cannot delete a user who has authored questions, batches, or attempts without reassigning or archiving.
