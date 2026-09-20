# Google Gemini Multimodal PDF Extraction & Hybrid Reconciliation

## 1. Overview
The ExamPrep ingestion subsystem incorporates **Google Gemini Multimodal Document Understanding** (`@google/genai`) to extract complex exam PDFs (e.g. JEE Main, NEET, GATE) with high fidelity. The engine natively captures mathematical LaTeX equations, chemical notations, match-list structures, answer keys, and visual diagram figures, backed by a deterministic local parser fallback and key-based hybrid reconciliation.

---

## 2. Extraction Engines & Selection Guide

The extraction pipeline supports three engine modes configured via the `EXTRACTION_ENGINE` environment variable:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTRACTION_ENGINE                                │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
            'hybrid' (Default & Prod)              'gemini'               'local'
                       │                               │                     │
                       ▼                               ▼                     ▼
          • Primary: Google Gemini             • Pure Gemini         • 100% Offline
          • Auto-trigger cross-validation      • Fast & low compute  • Deterministic
            on low-confidence questions        • Local fallback only   regex parser
          • Match by questionNumber              if Gemini fails     • Zero AI cost
          • Recover missed questions as                              • No visual diagram
            LOCAL_ONLY_RECOVERED                                       capture
```

### Engine Decision Matrix

| Mode | Primary Engine | Cross-Validation / Reconciliation | Visual Diagram Capture | Offline / No-Key Support | Recommended Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`hybrid`** | Google Gemini (2.5 Flash) | **Yes** — triggers deterministic cross-check if confidence < threshold or critical errors occur | **Yes** (Page rasterization + sharp crop) | **Yes** (falls back to local parser automatically) | **Production standard for competitive exam platforms.** |
| **`gemini`** | Google Gemini (2.5 Flash) | **No** — uses Gemini candidates directly | **Yes** | **Yes** (falls back only if API throws) | Cost-sensitive or lightweight cloud deployments. |
| **`local`** | Deterministic Parser | N/A | No | **Yes** | Local development without API credentials. |

---

## 3. Environment Configuration

Configure the following variables in `backend/.env`:

```env
# Google Gemini API Key (@google/genai SDK)
# If left unset, pipeline gracefully runs in local deterministic mode.
GEMINI_API_KEY=your_gemini_api_key_here

# Model to use for multimodal document understanding
GEMINI_MODEL=gemini-2.5-flash

# Active extraction strategy: 'hybrid' | 'gemini' | 'local'
EXTRACTION_ENGINE=hybrid

# Threshold (0.0 to 1.0) of non-HIGH confidence candidates to trigger hybrid reconciliation
HYBRID_RECONCILIATION_THRESHOLD=0.3
```

---

## 4. Visual Asset Capture & In-Memory Cropping Flow

For questions containing diagrams, circuit figures, or chemical structures (`hasVisual = true`):

```
PDF Buffer
   │
   ▼
[renderPageToImage] (In-memory 150 DPI rasterization via pdfjs-dist + node-canvas)
   │
   ▼
[cropImageBuffer] (Precision cropping via sharp using normalized boundingBox { x, y, width, height })
   │
   ▼
[StorageProvider.saveFile] (Persists diagram as diagram-<uuid>.png)
   │
   ▼
candidate.diagram_url = "/uploads/diagram-<uuid>.png"
```

- **Zero Disk Leaks**: Page rendering and cropping happen entirely in memory buffers.
- **Graceful Failure**: If a diagram crop fails, the question is preserved with `diagram_url: null` without failing the batch.
- **Zero Overhead on Text Questions**: Text-only questions skip all rasterization and image storage calls.

---

## 5. Key-Based Hybrid Reconciliation (PROMPT 26 Fix)

When hybrid mode cross-validates Gemini output against the local parser:
1. **Key-Based Indexing**: Builds a `Map<number, CandidateQuestion>` from local candidates keyed by `questionNumber` (e.g. Q1, Q2, Q3).
2. **Deterministic Matching**: Gemini candidates match strictly by question number against their local counterparts. This eliminates array-index shifting bugs when the two parsers find different subsets of questions.
3. **High-Confidence Merging**: If the local parser achieves `HIGH` confidence on options/answers while Gemini produced `LOW`/`MEDIUM`, local options and answers are merged while preserving visual diagram URLs and formatted stems.
4. **Local Question Recovery**: Any question detected by the local parser that Gemini missed is surfaced as `LOCAL_ONLY_RECOVERED` with `needsReview: true` so no question is ever lost.

---

## 6. Gated Live-API Integration Testing

The test suite includes a genuine, live-API test in `backend/tests/geminiLive.integration.test.ts` that runs real PDF extractions against the Gemini API.

### Execution

By default, standard test runs (`npm test` / CI) skip this test to prevent unneeded API calls. To opt in and run the live integration test:

```bash
# Windows PowerShell
$env:RUN_LIVE_GEMINI_TESTS="true"
$env:GEMINI_API_KEY="your_api_key"
npx vitest run tests/geminiLive.integration.test.ts

# Linux / macOS
RUN_LIVE_GEMINI_TESTS=true GEMINI_API_KEY=your_api_key npx vitest run tests/geminiLive.integration.test.ts
```

### Verified Properties:
- **Chemical Bonding Reference PDF**: Validates 13 questions extracted with LaTeX formulas, option arrays, and diagram capture.
- **Work Power Energy Reference PDF**: Validates 6 questions extracted with physical constants and equation fidelity.
- **Structural Integrity**: Confirms every candidate has ≥ 2 options and contains zero leaked boilerplate or raw tab characters.

---

## 7. Telemetry & Security Guardrails

1. **Health Telemetry (`GET /api/v1/health`)**:
   Exposes real-time extraction engine status and Gemini configuration safely:
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
2. **Zero Credential Leaks**:
   - `GEMINI_API_KEY` is redacted from all error messages (`[REDACTED_API_KEY]`) and diagnostic logs.
   - Diagnostic logs emit structured batch statistics (engine, candidate counts, confidence breakdown) without dumping PDF text or secret keys.
3. **Rate Limiting**:
   - `POST /api/v1/ingestion/upload` is rate-limited to 30 requests per 15 minutes per IP/User to prevent denial-of-wallet and quota exhaustion.
