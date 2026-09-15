# ExamPrep

ExamPrep is a centralized exam-preparation platform separating question ingestion from quiz generation, designed to streamline content workflows and deliver targeted practice assessments.

## Getting Started

Please see the [Local Development Guide](docs/LOCAL_DEV.md) for full prerequisites and environment configuration instructions.

### Quick Start

1. **Start PostgreSQL (via Docker):**
   ```bash
   docker compose up -d
   ```
2. **Install all dependencies:**
   ```bash
   npm install
   ```
3. **Run frontend and backend concurrently:**
   ```bash
   npm run dev
   ```
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend: [http://localhost:4000/api/v1/ping](http://localhost:4000/api/v1/ping)

## Project Structure

- `frontend/` - React + TypeScript + Vite frontend application.
- `backend/` - Node + Express + TypeScript modular monolith backend.
- `docs/` - Project documentation and architecture specifications.
