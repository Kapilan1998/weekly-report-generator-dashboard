# Implementation Plan

Tracks progress phase by phase. Check items off as they're actually done (not just
started) — this file is the source of truth for "what's left" across sessions.

## Phase 0 — Foundations (partially done)
- [x] Backend project created (Spring Boot 4.1.1, Java 21, `backend/weekly-report-backend`)
- [x] MySQL connectivity configured (`spring.datasource.*` in `application.properties`)
- [ ] `frontend/` scaffolded with Vite + React + TypeScript + Tailwind
      (`npm create vite@latest . -- --template react-ts`, then add Tailwind)
- [ ] Add Flyway dependency to backend `pom.xml`; disable
      `spring.jpa.hibernate.ddl-auto` in favor of migrations (or set it to `validate`)
- [ ] `V1__init_schema.sql` Flyway migration matching `docs/DATA_MODEL.md`
- [ ] Root `README.md` setup instructions filled in and verified to actually work end
      to end (install → run frontend → run backend → run database)

## Phase 1 — Backend: Auth & RBAC
- [ ] `User` entity + repository, `Role` enum (`TEAM_MEMBER`, `MANAGER`)
- [ ] Spring Security config: stateless session, JWT filter, password hashing (BCrypt)
- [ ] `JwtService` (issue + parse/validate tokens)
- [ ] `POST /api/auth/register`, `POST /api/auth/login`
- [ ] `@PreAuthorize` role checks wired on a couple of trivial endpoints to prove the
      setup works end to end before building on top of it
- [ ] Global exception handler (`@ControllerAdvice`) for validation errors, 401/403, etc.

## Phase 2 — Backend: Reports core + workflow
- [ ] `Project`, `Report`, `ReportVersion`, `TaskEntry`, `Blocker`, `Achievement`,
      `HoursEntry`, `ReviewComment` entities + repositories
- [ ] `POST /api/reports` (create draft), `PUT /api/reports/{id}` (edit while
      Draft/Needs Correction), `POST /api/reports/{id}/submit`
- [ ] `GET /api/reports/mine` (own history, paginated)
- [ ] `GET /api/reports/{id}` (detail; ownership or manager check)
- [ ] `GET /api/reports/{id}/versions` (past versions list)
- [ ] Manager actions: `POST /api/reports/{id}/approve`,
      `POST /api/reports/{id}/request-changes` (body: comment)
- [ ] `GET /api/reports` (manager-wide list) with pagination + filters: team member,
      project, date range, status
- [ ] Service-layer ownership enforcement (team member can only touch their own
      reports; manager can only touch status/comment, never version content)

## Phase 3 — Backend: Projects & dashboard aggregates
- [ ] `Project` CRUD endpoints (`GET/POST/PUT/DELETE /api/projects`)
- [ ] Optional: `ProjectMember` assignment endpoints
- [ ] Dashboard summary endpoint(s): reports-submitted-this-week, compliance rate,
      needs-correction count, open-blockers count
- [ ] Chart-data endpoints: tasks-completed trend, status-by-team-member, workload by
      project, hours by task type, recent activity feed

## Phase 4 — Frontend: foundation
- [ ] Vite + TS + Tailwind scaffold running (`npm run dev`)
- [ ] Routing (`react-router`), `ProtectedRoute` by role
- [ ] `AuthContext` + login/register pages wired to backend
- [ ] `api/` client with JWT attach + 401 handling (redirect to login)
- [ ] Base layout/nav shared across pages, responsive

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
