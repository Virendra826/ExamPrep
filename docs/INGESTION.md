# Question Ingestion Pipeline & Architecture

## Overview
The Ingestion module (`backend/src/modules/ingestion`) handles the intake of educational content (PDF documents) and converts them into structured question bank records.

Per the master architecture guidelines:
1. **Strict Decoupling**: Ingestion is completely decoupled from quiz generation. The quiz engine never parses, stores, or accesses PDF files at quiz runtime.
2. **Primary Multimodal Document Understanding (Google Gemini)**: Uploaded PDFs are processed server-side using Google Gemini (`@google/genai`) for native multimodal layout, mathematical/chemical LaTeX notation, match-list structures, and answer-key separation.
3. **Resilient Local Fallback**: If Gemini is unconfigured or encounters transient rate limits / API failures, the ingestion pipeline seamlessly falls back to the deterministic local PDF extraction engine.
4. **Review Gateway**: Extracted candidate questions are never auto-published or directly inserted as active questions. They remain as in-memory candidate representations until an administrator reviews, edits, and explicitly submits them.
5. **Traceability**: Persisted questions created from ingestion batches retain a foreign key reference (`ingestion_batch_id`) pointing to their source `IngestionBatch`.

---

## File Storage & Retention Policy

### Storage Abstraction
Storage is abstracted behind the `StorageProvider` interface:
- **Development**: `LocalStorageProvider` saves uploaded PDFs to a controlled `backend/uploads/` directory with randomly generated UUID filenames (`<uuid>.pdf`). The original user-supplied filename is never used as the filesystem path to prevent path traversal vulnerabilities.
- **Production**: `SupabaseStorageProvider` (to be enabled in Phase 18) stores files in an isolated Supabase Storage bucket.

### File Signature & Validation
- **MIME Type**: Must be `application/pdf`.
- **Magic Bytes Signature**: Validated against `%PDF-` header bytes (`0x25, 0x50, 0x44, 0x46, 0x2D`). Files with renamed extensions or spoofed Content-Type headers are rejected immediately with HTTP 400.
- **Size Cap**: Maximum file size is 10MB (`MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`). Files exceeding this limit are rejected before processing.
- **Empty Files**: Files with 0 bytes are rejected.

### Retention & Cleanup Policy
- In-memory intermediate buffers from Multer are garbage-collected immediately once extraction completes.
- The stored source PDF remains preserved in storage keyed by `storage_key` on the `IngestionBatch` record for audit and administrative reference.
- Candidate questions remain in temporary memory store until either:
  - The admin submits the batch via `POST /api/v1/ingestion/:batchId/questions`, at which point candidates are persisted to the database and cleared from memory.
  - Server restart or timeout cleans up unsubmitted candidate states.

---

## Ingestion API Endpoints

All ingestion routes are protected by `requireAuth` and `requireRole('ADMIN')`:

### 1. `POST /api/v1/ingestion/upload`
- **Request**: Multipart form data with single file field `file`.
- **Response**: `201 Created`
  ```json
  {
    "batch": {
      "id": "uuid",
      "status": "EXTRACTED",
      "original_filename": "sample.pdf"
    },
    "candidates": [
      {
        "id": "cand-uuid",
        "question_text": "What is ...?",
        "options": [{ "text": "Option A" }, { "text": "Option B" }],
        "correct_answer": "Option A",
        "question_type": "CONCEPT",
        "needsReview": false
      }
    ]
  }
  ```

### 2. `GET /api/v1/ingestion/:batchId`
- **Response**: `200 OK`
  Returns current batch status and extracted candidates awaiting review.

### 3. `POST /api/v1/ingestion/:batchId/questions`
- **Request**:
  ```json
  {
    "questions": [
      {
        "question_text": "...",
        "options": [{ "text": "A" }, { "text": "B" }],
        "correct_answer": "A",
        "subject_id": "uuid",
        "chapter_id": "uuid",
        "question_type": "CONCEPT"
      }
    ]
  }
  ```
- **Response**: `201 Created`
  Persists valid rows into `questions` table with `source = 'PDF'` and `status = 'DRAFT'`, transitioning `IngestionBatch.status = 'REVIEWED'`.
