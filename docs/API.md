# ExamPrep — REST API Specification

All endpoints are prefixed with `/api/v1` unless noted otherwise.

---

## 1. Authentication & Session Management (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register a new student user. Sets HTTP-only refresh token cookie and access token cookie. |
| `POST` | `/auth/login` | Public | Authenticate user with email and password. |
| `POST` | `/auth/logout` | Authenticated | Revoke refresh token and clear auth cookies. |
| `POST` | `/auth/refresh` | Public (Cookie) | Rotate refresh token and issue new access token. |
| `GET` | `/auth/me` | Authenticated | Return currently authenticated user profile. |

---

## 2. Curriculum & Taxonomy (`/api/v1/subjects`, `/api/v1/chapters`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/subjects` | Authenticated | List all active subjects with chapter counts. |
| `POST` | `/subjects` | Admin Only | Create a new subject. |
| `GET` | `/subjects/:subjectId/chapters` | Authenticated | List chapters belonging to a subject. |
| `POST` | `/chapters` | Admin Only | Create a new chapter under a subject. |

---

## 3. Question Bank Management (`/api/v1/questions`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/questions` | Admin Only | Paginated question bank list with filtering by subject, chapter, type, difficulty, and status. |
| `POST` | `/questions` | Admin Only | Create a manual question with options and correct answer. |
| `GET` | `/questions/:questionId` | Admin Only | Fetch full question details. |
| `PUT` | `/questions/:questionId` | Admin Only | Update an existing question. |
| `DELETE` | `/questions/:questionId` | Admin Only | Soft delete / deactivate a question. |
| `GET` | `/questions/available-count` | Authenticated | Return available active question count for given filters (subject, chapter, type). |
| `PATCH`| `/questions/bulk-status` | Admin Only | Bulk activate/deactivate questions or bulk set difficulty. |

---

## 4. PDF Ingestion Subsystem (`/api/v1/ingestion`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/ingestion/upload` | Admin Only | Upload PDF document (max 10MB). Rate-limited (30 req/15 min). Runs primary Gemini extraction with hybrid local reconciliation. |
| `GET` | `/ingestion/:batchId` | Admin Only | Retrieve extracted candidate questions awaiting review. |
| `POST` | `/ingestion/:batchId/questions` | Admin Only | Commit reviewed candidate questions to the active question bank. |

---

## 5. Quiz Generation & Attempt Solving (`/api/v1/quiz`, `/api/v1/attempts`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/quizzes` (or `/quiz`) | Authenticated | Generate a new quiz with `FIXED` or `VARIABLE` timer mode and snapshot `QuizQuestion[]`. |
| `GET` | `/quizzes/:quizId` | Authenticated | Fetch quiz configuration (excluding answers). |
| `GET` | `/attempts` | Authenticated | List paginated attempt history for authenticated user. |
| `GET` | `/attempts/:attemptId` | Authenticated | Fetch active attempt questions and pre-fill saved answers (excluding correct answers & explanations). |
| `POST` | `/attempts/:attemptId/start` | Authenticated | Transition attempt from `CREATED` to `IN_PROGRESS` and start server timer. |
| `PUT` | `/attempts/:attemptId/answers/:quizQuestionId` | Authenticated | Save or update selected option for a question. |
| `POST` | `/attempts/:attemptId/submit` | Authenticated | Submit attempt, calculate scores, create `Result` record, and transition to `EVALUATED`. |
| `GET` | `/attempts/:attemptId/result` | Authenticated | Fetch score, percentage, accuracy, and detailed question-by-question review with explanations. |

---

## 6. Analytics & Dashboard (`/api/v1/analytics`, `/api/v1/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/analytics/summary` | Authenticated | Overall student statistics (total attempts, accuracy, total time spent). |
| `GET` | `/analytics/chapter-performance` | Authenticated | Chapter-by-chapter mastery and accuracy breakdown. |
| `GET` | `/admin/dashboard-summary` | Admin Only | Summary statistics for admin overview (subjects, chapters, questions, batches). |

---

## 7. System Health & Telemetry (`/health`, `/api/v1/health`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` (or `/api/v1/health`)| Public | Returns database connection status and extraction engine configuration (`{ status: "ok", db: "connected", extraction: { engine: "hybrid", geminiConfigured: true } }`). |
| `GET` | `/ping` | Public | Lightweight liveness check (`{ status: "ok" }`). |
