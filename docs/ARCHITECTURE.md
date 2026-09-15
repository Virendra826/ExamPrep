# Architecture Specification

## Architecture Freeze

> **Notice:** Do not change these choices without a dedicated architecture-change proposal.

The technology stack for ExamPrep V1 is locked as follows:

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript (modular monolith, REST)
- **Database (DB):** PostgreSQL (hosted on Supabase)
- **ORM:** Prisma
- **Validation:** Zod
- **Authentication (Auth):** JWT-cookie authentication
- **Testing:** Vitest, Supertest, Playwright
- **Hosting & Infrastructure:**
  - Frontend: Vercel
  - Backend: Render
  - Database & Storage: Supabase
