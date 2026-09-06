# weekly-report-generator-dashboard

Full stack team reporting platform with role based workflows, a submit/review/correction
cycle and a manager analytics dashboard built with Spring Boot, React and MySQL.

> **Status:** backend auth/RBAC and the full report + review workflow are implemented, along
> with the frontend foundation (login/register, routing, my-reports, team dashboard). The
> report form, report detail, version-history and review pages, plus the dashboard charts,
> are still to come — see [`docs/PLAN.md`](docs/PLAN.md).

## Project docs
- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — condensed assignment requirements
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — entity/relationship design
- [`docs/PHASE2_SPEC.md`](docs/PHASE2_SPEC.md) — report schema, endpoints and workflow rules
- [`docs/PLAN.md`](docs/PLAN.md) — phased implementation checklist
- [`docs/PAGES.md`](docs/PAGES.md) — required pages inventory

## Setup Instructions

### 1. Installing dependencies

Install once:

- **JDK 21** — the backend targets Java 21. Maven itself is not required; the repo ships the
  `mvnw` / `mvnw.cmd` wrapper.
- **Node.js** (LTS) and **npm** — for the frontend.
- **MySQL 8.x** — running locally, or in a container.

Then fetch the project dependencies:

```bash
cd backend/weekly-report-backend && ./mvnw dependency:resolve   # mvnw.cmd on Windows
cd ../../frontend && npm install
```

### 2. Running the database

Just make sure your local MySQL server is running. There is **no migration command to run
by hand**:

- The connection string is
  `jdbc:mysql://localhost:3306/weekly_report_dashboard?createDatabaseIfNotExist=true`, so
  the database is created on first connection if it doesn't exist.
- The schema is owned by **Flyway**, which is a library inside the backend, not a separate
  tool. On every startup it looks in
  `backend/weekly-report-backend/src/main/resources/db/migration/`, applies any migration
  it hasn't applied yet, and records what it did in a `flyway_schema_history` table it
  manages itself. Starting the backend is all it takes.
- `V2` also inserts five projects, so the API is usable immediately.

Credentials live in `backend/weekly-report-backend/src/main/resources/application.properties`
(`root` / `12345` by default) — change them there to match your MySQL setup.

### 3. Running the backend

```bash
cd backend/weekly-report-backend
./mvnw spring-boot:run          # mvnw.cmd on Windows
```

Serves the REST API on `http://localhost:8080`. Wait for
`Started WeeklyReportBackendApplication` before using the frontend.

### 4. Running the frontend

In a **second terminal**:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`. The dev server proxies `/api` to `http://localhost:8080`, so
the browser only talks to its own origin and CORS never comes into play in development.

**Start the backend first** — the frontend has nothing to talk to otherwise, and calls will
fail with "Cannot reach the server".

### Creating a manager account

Self-registration always creates a **team member**, deliberately: a client-supplied role on
a public endpoint would let anyone grant themselves manager access. To get a manager, set
the role directly in the database for now (a proper admin user-management page is planned):

```sql
UPDATE users SET role = 'MANAGER' WHERE email = 'you@example.com';
```

Sign out and back in afterwards, since the role is carried in the JWT.
