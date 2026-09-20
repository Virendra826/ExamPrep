# ExamPrep — Production Deployment & Configuration Guide

This guide details the production architecture, environment configuration, dependency management (including `sharp` and Google Gemini), cost projections, and storage policies for deploying the **ExamPrep** platform.

---

## 1. System Architecture & Topology

- **Backend**: Node.js (v20+ LTS), Express REST API, Prisma ORM.
- **Database**: PostgreSQL (v15+) with connection pooling.
- **Frontend**: React 19 SPA (Vite bundle), served via static CDN / Render Web Service / Vercel.
- **PDF Extraction**: Hybrid Multimodal Engine (`@google/genai` Gemini 2.5 Flash primary + local deterministic parser fallback).
- **Image Processing**: `sharp` (in-memory rasterization, cropping, and bounding-box normalization).
- **Storage**: `StorageProvider` abstraction (`LocalStorageProvider` in dev; `SupabaseStorageProvider` or S3 in production).

---

## 2. Production Environment Variables

### Backend (`backend/.env`)

| Variable | Type | Default | Required in Prod | Description / Fallback Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | `number` | `4000` | No | Port for the Express server to listen on. |
| `NODE_ENV` | `string` | `development` | **Yes** | Set to `production` in live environments to enable production security headers, error masking, and CORS enforcement. |
| `DATABASE_URL` | `string` | — | **Yes** | PostgreSQL connection string (e.g. `postgresql://user:pass@ep-host.render.com/dbname?sslmode=require`). |
| `JWT_ACCESS_SECRET` | `string` | — | **Yes** | Minimum 16-character cryptographic secret for signing short-lived access tokens. |
| `JWT_REFRESH_SECRET` | `string` | — | **Yes** | Minimum 16-character cryptographic secret for signing persistent refresh tokens. |
| `CORS_ORIGIN` | `string` | `http://localhost:5173` | **Yes** | Production frontend domain (e.g. `https://examprep.dev`). |
| `STORAGE_DRIVER` | `string` | `local` | **Yes** | Storage driver: set to `supabase` in production (`local` for dev). |
| `SUPABASE_URL` | `string` | — | **Yes** (if `supabase`) | Supabase project base URL (e.g. `https://[PROJECT_REF].supabase.co`). |
| `SUPABASE_SERVICE_KEY` | `string` | — | **Yes** (if `supabase`) | Supabase `service_role` secret key for backend storage API operations. |
| `SUPABASE_STORAGE_BUCKET` | `string` | `examprep-assets` | No | Target Supabase storage bucket name for PDFs and extracted diagram crops. |
| `GEMINI_API_KEY` | `string` | — | **Yes** (Recommended) | Google Gemini API key. If left **unset**, the pipeline automatically and gracefully runs the deterministic local PDF parser without failing batches. |
| `GEMINI_MODEL` | `string` | `gemini-2.5-flash` | No | Multimodal model for PDF document analysis. |
| `EXTRACTION_ENGINE` | `string` | `hybrid` | **Yes** | Extraction strategy: `hybrid` (recommended), `gemini`, or `local`. |
| `HYBRID_RECONCILIATION_THRESHOLD` | `number` | `0.3` | No | Fraction of non-HIGH confidence questions (0.0 to 1.0) that triggers automatic local parser cross-validation. |

### Frontend (`frontend/.env`)

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `string` | `http://localhost:4000/api/v1` | Base URL for backend API requests (e.g. `https://api.examprep.dev/api/v1`). |

---

## 3. Extraction Engine Production Decision

### Chosen Production Value: `EXTRACTION_ENGINE=hybrid`

For production deployment of ExamPrep, **`hybrid`** is the designated production configuration.

### Rationale & Tradeoff Analysis

```
                               ┌────────────────────────────────┐
                               │     Uploaded PDF Document      │
                               └───────────────┬────────────────┘
                                               │
                                     [Primary Extraction]
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │      Google Gemini API         │
                               │  (Multimodal Layout + LaTeX)   │
                               └───────────────┬────────────────┘
                                               │
                           ┌───────────────────┴───────────────────┐
                           ▼                                       ▼
                 High Confidence (≥70%)                 Low Confidence / Errors
                           │                                       │
                           │                             [Trigger Hybrid Cross-Check]
                           │                                       │
                           │                                       ▼
                           │                        ┌─────────────────────────────┐
                           │                        │  Deterministic Local Parser │
                           │                        └──────────────┬──────────────┘
                           │                                       │
                           │                             [Key-Based Reconciliation]
                           │                             - Match by questionNumber
                           │                             - Merge high-conf local text
                           │                             - Recover missed questions
                           │                             - Retain Gemini visual crops
                           │                                       │
                           └───────────────────┬───────────────────┘
                                               │
                                               ▼
                               ┌────────────────────────────────┐
                               │  Candidate Questions in Review │
                               └────────────────────────────────┘
```

| Engine Mode | Strengths | Tradeoffs | Production Suitability |
| :--- | :--- | :--- | :--- |
| **`hybrid`** *(Recommended)* | • Maximum extraction accuracy.<br>• Native visual asset capture & cropping.<br>• Retains LaTeX math & chemical notation.<br>• Auto-reconciles against local parser on ambiguities.<br>• Zero lost questions (`LOCAL_ONLY_RECOVERED`). | • Slightly higher compute time when fallback triggers. | **Recommended for Production**: In competitive exam prep, question and diagram correctness is non-negotiable. |
| **`gemini`** | • Fastest execution per document.<br>• Lowest server CPU overhead. | • No deterministic cross-check for subtle edge-case hallucinations. | Suitable for cost-sensitive environments with low server compute. |
| **`local`** | • Zero external API cost.<br>• 100% offline. | • Cannot extract diagrams or complex visual figures.<br>• Lower mathematical LaTeX fidelity. | Development, offline environments, or zero-AI setups. |

---

## 4. Native Dependency: `sharp` in Render / Linux Build Environments

### Background
`sharp` (v0.33+) uses platform-specific prebuilt binary modules (`@img/sharp-linux-x64`, `@img/sharp-darwin-arm64`, `@img/sharp-win32-x64`). When installing on a development machine (e.g. Windows or macOS), `package-lock.json` might omit Linux-specific optional dependencies if generated with older npm versions.

### Render Build Configuration
In Render's build settings, set the build command to:

```bash
# Standard Monorepo Build Command
npm install --include=optional && npm run build
```

If cross-platform lockfile discrepancies occur during container deployment, specify the exact Linux binary flag:

```bash
# Explicit Platform-Targeted Installation
npm install --platform=linux --arch=x64 sharp && npm run build
```

---

## 5. Gemini Token Volume, Cost Estimation & Rate Limiting

### Cost Projections per PDF (Gemini 2.5 Flash)
- **Input Tokens per PDF Page**: ~250–500 multimodal tokens per page (e.g. 5-page PDF ≈ 1,500–2,500 tokens).
- **Output Tokens per PDF**: ~1,000–2,000 structured JSON tokens.
- **Estimated Cost per Ingestion Batch**:
  - Gemini 2.5 Flash Pricing: ~$0.075 per 1M input tokens, ~$0.30 per 1M output tokens.
  - Cost per 10-question PDF: **~$0.0003 – $0.0008 USD** (< 0.1¢ per exam upload).

### Ingestion Rate Limiting Guardrail
To prevent runaway Gemini API consumption or denial-of-wallet vectors, the PDF upload endpoint is gated by route-level rate limiting:
- **Endpoint**: `POST /api/v1/ingestion/upload`
- **Limit**: Maximum **30 uploads per 15-minute window** per IP/User.
- **Status on Limit**: Returns HTTP `429 Too Many Requests` with code `RATE_LIMIT_EXCEEDED`.

---

## 6. Diagram Storage & Asset Lifecycle Management

### Asset Storage Architecture
1. **Diagram Capture**: When Gemini detects visual diagrams (`hasVisual = true`), `renderPageToImage` rasterizes the page in memory and `sharp` executes precision cropping using normalized bounding box coordinates.
2. **Persistence**: The cropped image buffer is stored via `StorageProvider.saveFile` as `diagram-<uuid>.png` (typical size: 20KB – 150KB).
3. **Question Reference**: The resulting URL is stored in `Question.diagram_url` upon batch commitment.

### Known Limitations & Retention Policy (V1)
- **Committed Questions**: Diagram images referenced by committed `Question` rows are permanent assets.
- **Unsubmitted / Rejected Batches (V1 Known Limitation)**: Files uploaded during batches that are abandoned or rejected remain in the storage bucket. For V1, storage growth is manageable (~50MB per 1,000 uploaded questions). For high-scale production, a 30-day lifecycle rule on temporary upload prefixes or an automated orphan prune cron job is recommended.

---

## 7. Health & Telemetry Verification

The `/health` endpoint exposes real-time database connectivity and extraction engine configuration safely without credential leakage:

### Endpoint: `GET /api/v1/health`

```json
{
  "status": "ok",
  "db": "connected",
  "extraction": {
    "engine": "hybrid",
    "geminiConfigured": true
  }
}
```

- **`extraction.engine`**: Current active extraction strategy (`'hybrid' | 'gemini' | 'local'`).
- **`extraction.geminiConfigured`**: `true` if `GEMINI_API_KEY` is present and valid; `false` otherwise (never exposes the key string).
