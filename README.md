# weekly-report-generator-dashboard
Full stack team reporting platform with role based workflows, a submit/review/correction cycle and a manager analytics dashboard built with Spring Boot, React and MySQL.

> **Status:** planning/scaffolding stage. See [`docs/PLAN.md`](docs/PLAN.md) for the
> implementation roadmap and [`CLAUDE.md`](CLAUDE.md) for repo conventions. The
> instructions below describe the target setup and will be verified/updated as each
> piece is actually built.

## Project docs
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — condensed assignment requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — entity/relationship design
- [`docs/PLAN.md`](docs/PLAN.md) — phased implementation checklist
- [`docs/PAGES.md`](docs/PAGES.md) — required pages inventory

## Setup Instructions

### 1. Prerequisites (installing dependencies)
- **Java 21** (JDK) and **Maven** (or use the included `mvnw`/`mvnw.cmd` wrapper)
- **Node.js** (LTS) and **npm** — for the frontend
- **MySQL** (8.x) running locally, or a Docker container

### 2. Running the database
- Start MySQL locally and ensure a user/password you control (matches
  `backend/weekly-report-backend/src/main/resources/application.properties`).
- The schema and seed data are managed by **Flyway migrations**, which run
  automatically on backend startup — no manual SQL scripts to run once Phase 0/1 of
  `docs/PLAN.md` land. The connection string
  (`spring.datasource.url=jdbc:mysql://localhost:3306/weekly_report_dashboard?createDatabaseIfNotExist=true`)
  creates the database itself if it doesn't exist yet.

### 3. Running the backend
```
cd backend/weekly-report-backend
./mvnw spring-boot:run       # or mvnw.cmd on Windows
```
Backend serves the REST API on `http://localhost:8080`.

### 4. Running the frontend
*(not yet scaffolded — see `frontend/README.md` and `docs/PLAN.md` Phase 4)*
```
cd frontend
npm install
npm run dev
```
Frontend dev server runs on `http://localhost:5173` and talks to the backend at
`http://localhost:8080`.
