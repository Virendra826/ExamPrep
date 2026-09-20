# ExamPrep — System Architecture Specification

## 1. Core Principles & Philosophy

1. **Strict Decoupling of Ingestion and Quiz Generation**:
   - The quiz engine never parses, accesses, or processes raw PDF documents at quiz runtime.
   - The PDF ingestion subsystem is an administrative authoring tool that converts unstructured documents into structured question bank records.
2. **Review Gateway**:
   - Extracted questions are never auto-published. They exist as candidate questions in memory until explicitly reviewed, assigned taxonomy, and committed by an administrator.
3. **Multimodal Multilingual & High-Fidelity Notation**:
   - Multimodal document understanding via Google Gemini 2.5 Flash preserves mathematical LaTeX equations, chemical formulas, match-list structures, and bounding-box coordinates for visual diagrams.
4. **Key-Based Hybrid Reconciliation & Zero Question Loss**:
   - Cross-validates Gemini candidates against the deterministic local parser by matching unique `questionNumber` keys.
   - Preserves high-confidence local options/answers and visual diagram URLs, while surfacing any question missed by Gemini as `LOCAL_ONLY_RECOVERED`.
5. **Security & Data Isolation**:
   - HTTP-only JWT access and refresh token cookies prevent XSS credential harvesting.
   - Questions during active quiz solving strictly omit `correct_answer` and `explanation` payloads to eliminate client-side answer inspection.

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS design system, Lucide icons.
- **Backend**: Node.js (v20+ LTS), Express REST API, TypeScript (modular monolith architecture).
- **Database & ORM**: PostgreSQL 15+ with Prisma ORM.
- **AI & Multimodal Document Engine**: `@google/genai` (Google Gemini 2.5 Flash) with native JSON schema validation (`responseSchema`) and secondary Zod verification.
- **Image Processing**: `pdfjs-dist` (in-memory canvas rendering) + `sharp` (precision bounding-box cropping).
- **Storage**: `StorageProvider` abstraction (`LocalStorageProvider` for dev, `SupabaseStorageProvider` for prod).
- **Validation**: Zod schema validation across all API boundaries and LLM responses.
- **Testing**: Vitest, Supertest, React Testing Library.

---

## 3. Subsystem Modules

```
backend/src/
├── config/             # Environment, Prisma client, and configuration schemas
├── middleware/         # Auth (JWT), RBAC, error handling, rate limiting, security headers
├── modules/
│   ├── admin/          # Admin dashboard analytics & aggregations
│   ├── analytics/      # Student performance summary & chapter mastery breakdown
│   ├── attempts/       # Quiz attempt lifecycle, answer saving, timer enforcement
│   ├── auth/           # Registration, login, token refresh, and cookie management
│   ├── chapters/       # Chapter CRUD & taxonomy relations
│   ├── ingestion/      # PDF processing:
│   │   ├── gemini/     # Gemini client, prompts, JSON schemas, normalizers, visual capture
│   │   ├── extraction  # Deterministic local regex parser & section boundary detector
│   │   ├── service     # Ingestion batch lifecycle, key-based hybrid reconciliation
│   ├── questions/      # Question bank CRUD, bulk operations, available counts
│   ├── quiz/           # Quiz configuration, question selector engine, snapshot generator
│   └── subjects/       # Subject CRUD & curriculum management
├── routes/             # Health, ping, and root routing
└── storage/            # Local & Supabase StorageProvider implementations
```

---

## 4. Ingestion & Visual Pipeline Architecture

```
                    ┌─────────────────────────────────────────┐
                    │               Uploaded PDF              │
                    └────────────────────┬────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
               [Gemini Multimodal API]        [Deterministic Parser]
               (LaTeX, match-lists, JSON)     (Regex boundaries, text)
                         │                               │
                         ├───────────────────────────────┤
                         ▼                               ▼
                 [hasVisual === true]           [Confidence Scoring]
                         │                               │
                         ▼                               │
               [renderPageToImage (pdfjs)]               │
                         │                               │
                         ▼                               │
               [cropImageBuffer (sharp)]                 │
                         │                               │
                         ▼                               │
               [StorageProvider (PNG)]                   │
                         │                               │
                         └───────────────┬───────────────┘
                                         │
                                         ▼
                        [reconcileHybridCandidates]
                        - Match by questionNumber
                        - Merge high-conf answers
                        - Preserve diagram URLs
                        - Recover missed questions
                                         │
                                         ▼
                        [Candidate Review Gateway UI]
                                         │
                                         ▼
                            [Commit to Database]
```

---

## 5. Deployment Topology

- **Web Application**: Static client deployment via CDN / Vercel.
- **Backend API**: Render Web Service (Node.js Linux x64 container).
- **Database & Asset Storage**: Supabase Managed PostgreSQL + Storage Buckets.
