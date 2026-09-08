# Weekly Report Generator & Team Dashboard

A full-stack team reporting platform: team members file a structured weekly report, managers
review it — approving it or sending it back for correction through a versioned cycle — and
managers get an analytics dashboard across the whole team.

Spring Boot 4 · Java 21 · MySQL 8 (Flyway) · React 19 · TypeScript · Tailwind 4

> **Status:** feature-complete. Auth and RBAC, the versioned report/review workflow, project
> and user administration, dashboard aggregates, and all eleven frontend pages are
> implemented and wired to real backend data. `docs/PLAN.md` tracks what is left (the
> optional AI-chat bonus and deployment).

## Project docs

| Doc | What's in it |
|---|---|
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | The assignment brief, condensed and searchable |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture and the decisions behind it |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Entities, relationships and the ER diagram |
| [`docs/PHASE2_SPEC.md`](docs/PHASE2_SPEC.md) | Report schema, endpoints, status codes, workflow rules |
| [`docs/PAGES.md`](docs/PAGES.md) | Page-by-page inventory against the brief |
| [`docs/PLAN.md`](docs/PLAN.md) | Phase-by-phase implementation log |
| [`docs/diagrams/`](docs/diagrams/) | ER diagram as an image — PNG for slides, SVG for screen |

---

## Setup

### 1. Installing dependencies

Install once:

- **JDK 21 or newer** — the backend targets Java 21. Maven is not required; the repo ships
  the `mvnw` / `mvnw.cmd` wrapper.
- **Node.js** (LTS) and **npm** — for the frontend.
- **MySQL 8.x** — running locally, or in a container.

Then fetch the project's own dependencies:

```bash
cd backend/weekly-report-backend && ./mvnw dependency:resolve   # mvnw.cmd on Windows
cd ../../frontend && npm install
```

### 2. Running the database

Start your local MySQL server. **There is no migration command to run by hand:**

- The connection string is
  `jdbc:mysql://localhost:3306/weekly_report_dashboard?createDatabaseIfNotExist=true`, so the
  schema is created on first connection if it doesn't exist.
- The tables are owned by **Flyway**, which is a library inside the backend rather than a
  separate tool. On every start-up it applies any migration in
  `backend/weekly-report-backend/src/main/resources/db/migration/` that it hasn't applied
  yet, and records what it did in a `flyway_schema_history` table it manages itself.
  Starting the backend is all it takes.
- **Demo data is loaded automatically** the first time the backend starts against an empty
  database — see [Demo accounts](#demo-accounts) below.

Credentials live in
`backend/weekly-report-backend/src/main/resources/application.properties` (`root` / `12345`).
Change them there to match your MySQL setup. They are committed deliberately: it is a
throwaway local development credential, not a secret.

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
the browser only ever talks to its own origin and CORS never comes into play in development.
(The backend's CORS policy allows exactly `http://localhost:5173`, so use that port.)

**Start the backend first** — otherwise the frontend has nothing to talk to and calls fail
with "Cannot reach the server".

---

## Demo accounts

The first time the backend starts against an empty database it loads a demo dataset: two
managers, four team members, and six weeks of reports spread across every status.

**Password for every account below: `Demo@1234`**

| Email | Role | Why you'd sign in as them |
|---|---|---|
| `maya.sharma@example.com` | Manager | The full manager view: dashboard, charts, reviews, project and user administration |
| `tom.becker@example.com` | Manager | A second manager, who has also filed a report of their own |
| `priya.nair@example.com` | Team member | Has a report **submitted this week**, waiting for review |
| `daniel.osei@example.com` | Team member | Has a report **needing correction this week**, with the manager's comment on it |
| `sofia.rossi@example.com` | Team member | Has a **draft** this week, and a report last week with **two versions** from a full correction cycle |
| `liam.chen@example.com` | Team member | Has filed **nothing this week** — the brief's "not started" state |

A five-minute tour that touches every requirement:

1. Sign in as **Priya**, open her current-week report, and see it locked while under review.
2. Sign in as **Maya** → *Team dashboard*. Summary tiles, four charts, who has filed this
   week, and the activity feed. Try the filters, including **Not started**.
3. Click **Review** on Priya's row → approve it, or send it back with a comment.
4. Open **Sofia's** report from last week → *Version history* shows version 1 intact next to
   version 2, with each review comment attached to the version it was made against.
5. Sign in as **Daniel** → his correction banner names the reviewer and the version; edit and
   resubmit to fork a new version.
6. Back as **Maya** → *Compare sections* reads one section (blockers, achievements, …) across
   the whole team for a chosen week.

### Reloading the demo data

The loader only runs when the `users` table is **empty**, so it can never overwrite data you
have entered. To get a clean demo database back:

```sql
DROP DATABASE weekly_report_dashboard;
```

Then restart the backend — Flyway recreates the schema and the loader repopulates it. Every
week is computed relative to the day you run it, so the dashboard always opens on a current
week with something in it.

To turn the loader off entirely, start the backend with `--app.seed.enabled=false`.

---

## Running the tests

```bash
cd backend/weekly-report-backend
./mvnw test          # mvnw.cmd on Windows
```

**185 tests**, in two layers:

- **Mockito unit tests** for every controller and every service (172 tests, 14 classes, no
  Spring context — they run in about two seconds). This is where the rules are pinned: week
  normalisation, the lazy version fork, the three user-administration guards, compliance
  arithmetic, chart zero-filling, and the sort whitelist.
- **`security/RoleBasedAccessControlTest`** (12 tests) drives the real filter chain with real
  JWTs, because RBAC is a property of the filter chain and the method-security proxy that a
  mocked test cannot observe. It asserts that a team member cannot read a peer's report (404,
  not 403, so ids can't be enumerated), cannot reach any manager-only endpoint, cannot
  register themselves as a manager, and that disabling an account revokes an already-issued
  token.

Only that last class touches a database, and it uses its own schema
(`weekly_report_dashboard_test`, created automatically) so it never sees your development
data. It needs the same local MySQL and no Docker — see
`src/test/resources/application-test.properties` for why H2 and Testcontainers were both
ruled out.

---

## What to look at first

If you're reviewing this codebase, these are the parts where the design decisions are:

- **The review workflow** — `service/ReportReviewService.java`. It has no dependency that can
  write report content, so "a manager may only change status and comment" is a property of the
  class graph rather than a rule someone has to remember.
- **Versioning** — `docs/PHASE2_SPEC.md`. Requesting changes creates no version; the author's
  next edit forks one. That is what keeps earlier versions readable.
- **Authorization** — `service/ReportAccessGuard.java`, and the note there on why ownership is
  always checked *before* workflow status.
- **Dashboard aggregates** — `service/DashboardService.java`. Every content aggregate is
  restricted to each report's current version, or a corrected report would be counted once
  per version.
- **Charts without a charting library** — `frontend/src/components/charts/`, and the decision
  recorded in `docs/ARCHITECTURE.md`.
