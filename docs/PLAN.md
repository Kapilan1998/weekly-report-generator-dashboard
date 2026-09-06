# Implementation Plan

Tracks progress phase by phase. Check items off as they're actually done (not just
started) — this file is the source of truth for "what's left" across sessions.

## Phase 0 — Foundations (partially done)
- [x] Backend project created (Spring Boot 4.1.1, Java 21, `backend/weekly-report-backend`)
- [x] MySQL connectivity configured (`spring.datasource.*` in `application.properties`)
- [x] `frontend/` scaffolded with Vite + React + TypeScript + Tailwind. Note the installed
      majors: **Tailwind 4** (CSS-first — no `tailwind.config.js`, no PostCSS step, the
      `@tailwindcss/vite` plugin does it) and **React Router 7**. `tsconfig.app.json` sets
      `erasableSyntaxOnly`, so there are no TS `enum`s — see `frontend/README.md`.
- [x] Add Flyway dependency to backend `pom.xml`; `spring.jpa.hibernate.ddl-auto` set to
      `validate` (schema now owned by migrations)
- [x] `V1__create_users_table.sql` Flyway migration (users table only so far — more
      tables land per phase as their entities are added)
- [x] Root `README.md` setup instructions filled in and verified end to end (install → run
      database → run backend → run frontend), against a real MySQL and a real browser

## Phase 1 — Backend: Auth & RBAC ✅ done (branch `feature/auth-rba`)
- [x] `User` entity + repository, `Role` enum (`TEAM_MEMBER`, `MANAGER`)
- [x] Spring Security config: stateless session, JWT filter, password hashing (BCrypt)
- [x] `JwtService` (issue + parse/validate tokens)
- [x] `POST /api/auth/register`, `POST /api/auth/login`
- [x] `@PreAuthorize` role checks wired on `/api/ping/me` and `/api/ping/manager` —
      verified end to end: team member gets 200 on `/me`, 403 on `/manager`; manager
      gets 200 on both; no/garbage token gets 401 on either
- [x] Global exception handler (`@RestControllerAdvice`) for validation errors (400 +
      field errors), auth failures (401), access denied (403), and a custom
      `RestAuthenticationEntryPoint` so an unauthenticated request returns 401 (not
      Spring Security's default bare 403)

**Gotchas hit during Phase 1 (worth knowing before touching security/JSON code again):**
see the "Spring Boot 4.x gotchas" note in `CLAUDE.md`.

## Phase 2 — Backend: Reports core + workflow ✅ done (branch `feature/auth-rba`)

Authoritative spec: **`docs/PHASE2_SPEC.md`** (schema, endpoints, status codes, and the
reasoning behind each decision). Verified by an 88-check end-to-end run covering the whole
cycle and the RBAC matrix.

- [x] `Project`, `Report`, `ReportVersion`, `TaskEntry`, `Blocker`, `Achievement`,
      `HoursEntry`, `ReviewComment` entities + repositories, and
      `V2__create_reports_schema.sql` (seeds 5 projects so the API is reachable end to end)
- [x] `POST /api/reports` (create draft), `PUT /api/reports/{id}` (edit while
      Draft/Needs Correction), `POST /api/reports/{id}/submit`
- [x] `GET /api/reports/mine` (own history, paginated)
- [x] `GET /api/reports/{id}` (detail; owner sees their working copy, manager sees the
      latest submitted version and is refused another user's draft)
- [x] `GET /api/reports/{id}/versions` and `GET /api/reports/{id}/versions/{n}`
      (submitted snapshots only, each with the reviews made against it)
- [x] Manager actions: `POST /api/reports/{id}/approve`,
      `POST /api/reports/{id}/request-changes` (body: comment)
- [x] `GET /api/reports` (manager-wide list) with pagination + filters: team member,
      project, exact week, date range, status (repeatable)
- [x] `GET /api/reports/week-status?weekStart=` — one row per user including
      **not yet started**, the fifth value in the brief's status filter, which is the
      absence of a report row and so cannot be a status value
- [x] `GET /api/projects` (read-only; full CRUD is Phase 3) — needed for the report form
- [x] Service-layer ownership enforcement (`ReportAccessGuard`): a team member can only
      touch their own reports; a manager can only write status/comment, never version
      content; ownership is checked before workflow state so the state check can't be used
      as an existence oracle
- [x] Pessimistic row lock on all five mutating paths, so an edit and a submit cannot
      interleave and leave a frozen version whose children changed after submission
- [x] Sort-property whitelist on both list endpoints (`?sort=user.passwordHash` → 400)
- [x] `GlobalExceptionHandler` extended: type mismatch → 400, unreadable body → 400,
      data integrity → 409, unmapped path → 404, catch-all → 500, all with fixed messages
      that never echo driver text or caller input

**Fixed a Phase 1 privilege escalation while here:** `POST /api/auth/register` accepted a
client-chosen `role`, so anyone could mint a MANAGER account against a `permitAll`
endpoint and walk through every `hasRole('MANAGER')` gate. Registration now always creates
a `TEAM_MEMBER`; manager accounts come from seed data and the Phase 3 admin endpoint.

## Phase 3 — Backend: Projects & dashboard aggregates
- [ ] `Project` CRUD endpoints (`GET/POST/PUT/DELETE /api/projects`)
- [ ] Optional: `ProjectMember` assignment endpoints
- [ ] Dashboard summary endpoint(s): reports-submitted-this-week, compliance rate,
      needs-correction count, open-blockers count
- [ ] Chart-data endpoints: tasks-completed trend, status-by-team-member, workload by
      project, hours by task type, recent activity feed

## Phase 4 — Frontend: foundation ✅ done (branch `feature/frontend-foundation`)
- [x] Vite + TS + Tailwind scaffold running (`npm run dev` on 5173, `/api` proxied to 8080
      so dev is same-origin and CORS never comes up)
- [x] Routing (React Router 7), `ProtectedRoute` by auth and by role
- [x] `AuthProvider` + `useAuth`, login/register pages wired to the backend, token
      persisted so a refresh doesn't sign you out
- [x] `api/` client: single fetch wrapper, JWT attach, backend error shape unwrapped into a
      typed `ApiError` (incl. `fieldErrors`), one 401 handler that signs the user out
- [x] Base layout with role-aware nav, responsive (mobile nav toggle, tables scroll in their
      own container)
- [x] `src/types/api.ts` — TypeScript mirror of the backend DTOs, kept in sync by hand
- [x] Two pages reading real backend data to prove the chain end to end: my-reports list and
      the manager team dashboard with a status filter

Verified in a browser: unauthenticated redirect, login, register (incl. client-side
validation), token persistence across reload, role-aware nav, a team member being bounced
off `/team`, the manager list + filter, bad-credentials error display, mobile layout. Zero
console errors, zero lint warnings, clean `tsc -b` build.

## Phase 5 — Frontend: report pages
- [ ] Personal weekly report page (create/edit) — matches the fixed field structure,
      task-level sub-table, blocker/achievement flagging, hours breakdown
- [ ] Report history page (list + status per week)
- [ ] Report detail/view page (read-only, shared by both roles)
- [ ] Manager comment clearly visible on the report when Needs Correction
- [ ] Past-versions list on the detail page (on-demand view)
- [ ] Basic client-side validation (required fields, 0–100% ranges, etc.)

## Phase 6 — Frontend: manager dashboard & remaining pages
- [ ] Team dashboard: filters (member, project, date range, status), report list
- [ ] Manager review page: open a submitted report, Approve / Request Changes + comment
- [ ] Team member profile page (history + basic stats)
- [ ] Project/category management page (list + CRUD, not a modal)
- [ ] User management page (admin: invite/remove, assign roles)
- [ ] Summary metrics + charts on the dashboard (Recharts by default)
- [ ] Bonus: side-by-side single-section view (e.g. all Blockers) across the team for a
      selected week

## Phase 7 — Seed data
- [ ] Flyway seed migration (or a `CommandLineRunner`/data loader) creating 3–5 team
      members + 1–2 managers, several projects, and multiple weeks of reports across
      different statuses (some Draft, some Submitted, some Needs Correction with a
      comment, some Approved, some with >1 version) — enough for the dashboard to look
      real

## Phase 8 — Testing
- [ ] At least one automated test proving RBAC: a team member's request for another
      team member's report is rejected; a non-manager hitting a manager-only endpoint
      is rejected
- [ ] Port the Phase 2 end-to-end/RBAC checks into JUnit. They currently exist as a shell
      suite driven with curl (88 checks, all passing) which proved the behaviour but is not
      part of the build. Worth also asserting: register with `role=MANAGER` yields a
      TEAM_MEMBER; a peer's *approved* report still returns 404 (pins guard ordering); v1's
      child rows are unchanged after a full correction cycle.
- [ ] Decide the test database before writing these: `BIT(1)` defaults, MySQL `CHECK`
      constraints and `ddl-auto=validate` + Flyway mean the real V2 migration runs in any
      `@SpringBootTest` context, so H2 is not a drop-in. Testcontainers MySQL or a
      dedicated local test schema.

## Phase 9 — Bonus (optional, do last)
- [ ] AI Chat Assistant (LLM choice + integration approach TBD — document prompt design
      and data-privacy considerations if built)
- [ ] Deployment (publicly accessible instance)

## Phase 10 — Deliverables wrap-up
- [ ] Root README finalized and verified against a clean checkout
- [ ] ER diagram exported as an image into `docs/diagrams/`
- [ ] Presentation (Google Slides) covering architecture, DB design, frontend
      components, API/RBAC, review-workflow implementation, challenges, future
      improvements
- [ ] Demo video (camera on): both roles, full review/correction cycle, 2–3 different
      team members' reports, key features, frontend flow
- [ ] Google Drive folder assembled with sharing enabled; submission email drafted

## Notes for whoever (or whichever Claude session) picks this up
- See `CLAUDE.md` for repo conventions and current status at a glance.
- See `docs/ARCHITECTURE.md` and `docs/DATA_MODEL.md` before changing structure —
  update them if a design decision changes.
- See `docs/PAGES.md` for the page-by-page checklist against the assignment's Section 7.
