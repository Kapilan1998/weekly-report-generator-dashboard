# CLAUDE.md

Guidance for any Claude Code session working in this repository.

## What this project is

A technical assignment submission: **Weekly Report Generator & Team Dashboard** — a
full-stack app where team members submit structured weekly work reports and managers
review/approve them (or send them back for correction) through a versioned
submit/review/correction cycle, plus a manager analytics dashboard.

- Full requirements (source of truth): `Technical SE Assignment.pdf` (repo root)
- Condensed, searchable version: `docs/REQUIREMENTS.md`
- **Read `docs/PLAN.md` first** in any new session — it's the phase-by-phase checklist
  of what's done and what's next. Update it as work completes; don't let it go stale.

## Current status

Planning/scaffolding stage only. `docs/PLAN.md` Phase 0 is in progress. No frontend
code exists yet, no Flyway migrations exist yet, no report/auth backend logic exists
yet beyond the initial Spring Boot skeleton. Don't assume any endpoint or component
mentioned in the docs actually exists until you've checked the code.

## Tech stack (decided)

- **Backend:** Spring Boot 4.1.1, Java 21, Maven — `backend/weekly-report-backend/`
- **Frontend:** React + Vite + TypeScript (`.tsx`, not `.jsx`) + Tailwind CSS —
  `frontend/` (not yet scaffolded)
- **Database:** MySQL, schema managed via **Flyway** migrations under
  `backend/weekly-report-backend/src/main/resources/db/migration/` (not yet added —
  currently only `spring.datasource.*` connection properties exist)
- **Auth:** JWT (stateless) — backend issues on login, frontend sends as
  `Authorization: Bearer <token>`
- No separate top-level `database/` folder — see `docs/ARCHITECTURE.md` for why.

See `docs/ARCHITECTURE.md` for the full architecture and `docs/DATA_MODEL.md` for the
entity/relationship design (versioned reports — see that file before touching the
report/review schema, the versioning model is deliberate and required by the
assignment).

## Repo layout

```
Sisenco-Digital/
├── backend/weekly-report-backend/   # Spring Boot app
├── frontend/                        # React SPA (placeholder only so far)
├── docs/                            # REQUIREMENTS, ARCHITECTURE, DATA_MODEL, PLAN, PAGES
├── Technical SE Assignment.pdf       # original assignment brief
├── CLAUDE.md                        # this file
└── README.md                        # assignment-required setup instructions
```

## Conventions & working preferences

- **Git workflow:** default branch is `main`. **Do not commit or push unless the user
  explicitly asks in that message** — this user consistently wants to review changes
  and commit/push themselves. Staging/committing on request is fine; pushing without
  being asked is not.
- Don't add a separate `database/` folder — Flyway migrations live inside the backend
  per Flyway convention (see Architecture doc).
- `application.properties` currently contains a plaintext local dev DB password
  (`root`/local MySQL) — the user has explicitly chosen to commit it as-is since it's a
  throwaway local credential, not a real secret. Don't "fix" this unprompted.
- Keep `docs/PLAN.md` and `docs/PAGES.md` up to date as phases/pages are completed —
  they're the map for picking this project back up in a later session.
- The live-coding round for this assignment tests genuine understanding of the
  submitted code — favor clear, conventional, explainable code over clever
  abstractions.
