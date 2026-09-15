# Local Development Guide

This guide outlines the steps to configure and run the ExamPrep platform locally on your development machine.

---

## 1. Prerequisites

Ensure you have the following installed on your system:

- **Node.js**: Version `20.x` or higher (tested with `v24.x`)
- **npm**: Version `10.x` or higher (tested with `v11.x`)
- **Docker & Docker Compose**: Docker Desktop (Windows/Mac) or Docker Engine with Docker Compose plugin (Linux) for running the local PostgreSQL container.

---

## 2. Environment Configuration

Both the frontend and backend require an environment file. Copy the example configuration files to `.env` in each respective directory:

### Backend Environment
```bash
# In backend/
copy backend/.env.example backend/.env    # Windows (PowerShell/CMD)
# or: cp backend/.env.example backend/.env # macOS/Linux
```
Key configuration values in `backend/.env`:
- `PORT=4000`: Backend HTTP port
- `NODE_ENV=development`: Runtime environment
- `DATABASE_URL=postgresql://examprep:examprep_secret@localhost:5432/examprep_dev?schema=public`: Connection URL pointing to the local Postgres container
- `CORS_ORIGIN=http://localhost:5173`: Allowed origin for frontend SPA requests
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`: Secrets for authentication tokens (configured in later milestones)
- `STORAGE_DRIVER=local`: Storage provider selection

### Frontend Environment
```bash
# In frontend/
copy frontend/.env.example frontend/.env    # Windows (PowerShell/CMD)
# or: cp frontend/.env.example frontend/.env # macOS/Linux
```
Key configuration values in `frontend/.env`:
- `VITE_API_BASE_URL=http://localhost:4000/api/v1`: Base URL for API requests to the backend server

> **Note**: Both `.env` files are ignored by git to prevent committing sensitive keys or local machine overrides.

---

## 3. Starting the Local Database (PostgreSQL)

The repository provides a `docker-compose.yml` file at the root to spin up a PostgreSQL instance with a persistent volume.

Start the Postgres container in detached mode:
```bash
docker compose up -d
```

Verify container status:
```bash
docker compose ps
```

To stop the database container when finished:
```bash
docker compose down
```

To reset the database and clear all persistent volumes:
```bash
docker compose down -v
```

---

## 4. Installing Dependencies

Install dependencies for the root orchestrator as well as both subprojects:

```bash
# At the root of ExamPrep:
npm install

# In frontend:
npm install --prefix frontend

# In backend:
npm install --prefix backend
```

---

## 5. Running the Application

### Concurrently (Frontend + Backend)
To boot both the backend and frontend development servers simultaneously with unified, prefixed logging:

```bash
npm run dev
```

### Individual Development Servers
You can also run services independently if preferred:

```bash
# Run backend only (runs on http://localhost:4000 with hot-reload via tsx)
npm run dev:backend

# Run frontend only (runs on http://localhost:5173 with hot-reload via Vite)
npm run dev:frontend
```

---

## 6. Service Verification

Once both services are running:
- **Frontend SPA**: Open your browser at [http://localhost:5173](http://localhost:5173) to view the ExamPrep placeholder page.
- **Backend API Healthcheck**: Make a request to the ping endpoint:
  ```bash
  curl http://localhost:4000/api/v1/ping
  ```
  Expected response:
  ```json
  {"status":"ok"}
  ```

---

## 7. Additional Scripts

From the repository root, you can execute shared checks across both applications:

- **Build both apps**:
  ```bash
  npm run build
  ```
- **Run tests**:
  ```bash
  npm run test
  ```
- **Run linters**:
  ```bash
  npm run lint
  ```
- **Format code**:
  ```bash
  npm run format
  ```
