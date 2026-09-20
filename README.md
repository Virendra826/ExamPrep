# ExamPrep — Centralized Exam Preparation Platform

ExamPrep is a full-stack, enterprise-grade exam preparation platform designed for competitive exam coaching (JEE Main, NEET, GATE). The platform features an intelligent multimodal PDF ingestion subsystem that converts unstructured exam question papers into structured question bank records, decoupled from a high-performance quiz generation and solving engine.

---

## Key Features

1. **Intelligent Multimodal PDF Ingestion**:
   - Primary document understanding powered by **Google Gemini 2.5 Flash** (`@google/genai`) with native JSON Schema output enforcement.
   - Preserves mathematical LaTeX equations, chemical formulas, and match-list structures.
   - **Automated Visual Asset Capture**: In-memory page rasterization via `pdfjs-dist` and bounding-box cropping with `sharp` to store diagrams and figures.
   - **Key-Based Hybrid Reconciliation**: Cross-validates Gemini candidates against deterministic local parser by question number, recovering missed questions as `LOCAL_ONLY_RECOVERED`.
   - **Administrative Review Gateway**: Candidates are staged in memory for verification before database persistence.

2. **Decoupled Quiz Generation & Solving Engine**:
   - Generates quizzes by Subject, Chapter, Question Type (`CONCEPT`, `PYQ`, `BOTH`), and Order (`SEQUENTIAL`, `RANDOM`).
   - Supports **`FIXED`** (global timer with automatic timeout) and **`VARIABLE`** timer modes.
   - **Zero Answer Leakage**: Active solving endpoints strictly exclude correct answers and explanations.

3. **Analytics & Performance Tracking**:
   - Instant frozen scoring, accuracy analytics, time-spent telemetry, and chapter-by-chapter mastery breakdown.
   - Historical attempt review with step-by-step explanations.

---

## Quick Start

### Prerequisites
- Node.js v20+ LTS
- Docker (for local PostgreSQL) or an active PostgreSQL 15+ database

### Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Virendra826/ExamPrep.git
   cd ExamPrep
   ```

2. **Start PostgreSQL database:**
   ```bash
   docker compose up -d
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Configure environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

5. **Run database migrations and seed default curriculum:**
   ```bash
   npm run db:seed
   ```

6. **Start frontend and backend concurrently:**
   ```bash
   npm run dev
   ```
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

---

## Project Documentation

Detailed architecture specifications and guides are located in the [`docs/`](docs/) directory:

- [**System Architecture**](docs/ARCHITECTURE.md) — Architectural principles, tech stack, and module breakdown.
- [**Gemini Integration Guide**](docs/GEMINI_INTEGRATION.md) — Multimodal extraction, hybrid reconciliation, and live testing.
- [**Ingestion Pipeline**](docs/INGESTION.md) — File storage, signature validation, and review gateway.
- [**Deployment Guide**](docs/DEPLOYMENT.md) — Production variables, `sharp` Linux setup, cost estimates, and storage lifecycle.
- [**REST API Specification**](docs/API.md) — Full endpoint reference across all modules.
- [**Database Schema**](docs/DATABASE.md) — Entity relationships, Prisma models, and indexing strategy.
- [**Local Development**](docs/LOCAL_DEV.md) — Step-by-step developer onboarding and testing instructions.

---

## Available Monorepo Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start backend (`:4000`) and frontend (`:5173`) concurrently in development mode. |
| `npm run build` | Compile TypeScript backend (`tsc`) and bundle production frontend (`vite build`). |
| `npm run test` | Run complete backend and frontend automated test suites. |
| `npm run test:backend` | Run backend Vitest and Supertest integration test suite (28 test suites, 244 tests). |
| `npm run test:frontend`| Run frontend Vitest and React Testing Library test suite (14 test suites, 69 tests). |
| `npm run db:seed` | Seed default users (`admin@examprep.dev`, `student@examprep.dev`), subjects, chapters, and questions. |
| `npm run lint` | Run ESLint across backend and frontend codebases. |
| `npm run format` | Run Prettier formatter across all source files. |
