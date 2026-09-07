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

`docs/PLAN.md` Phases 1, 2, 4 and 5 are done: backend auth/RBAC, the report domain +
review workflow, the frontend foundation (all merged to `main`), and the report pages
(create/edit form, history, detail, version history — on branch `feature/report-pages`).

Phase 3 (project CRUD + dashboard aggregate endpoints) is also done, on branch
`feature/dashboard-api`.

Still to do: **Phase 6** (manager review page, project and user management pages, dashboard
tiles/charts — the backend it needs now exists), Phase 7 (seed data), Phase 8 (tests),
Phase 10 (deliverables). Don't assume any endpoint or component mentioned in the docs
actually exists until you've checked the code; `docs/PLAN.md` is the authoritative
done/not-done state per item.

**Any new aggregate query must restrict to each report's current version** — content hangs
off a version, so a corrected report is otherwise counted twice. See "Dashboard aggregate
rules" in `docs/PHASE2_SPEC.md`.

**Frontend report-page conventions** (see the notes under Phase 5 in `docs/PLAN.md` for the
reasoning): numeric form fields are held as strings and converted at serialise time; dynamic
rows are keyed by a client-generated id, never a server child id; validation is split into
structural rules and submit-only completeness rules.

**Read `docs/PHASE2_SPEC.md` before touching the report/review code.** It is the
authoritative spec for the schema, endpoints, status codes and lifecycle, and it records
*why* each decision was made — several of them are non-obvious and were chosen over
plausible alternatives for specific reasons (lazy version forking, 404 for a peer's report,
pessimistic locking on the edit path, no denormalized aggregates). Where it disagrees with
`docs/DATA_MODEL.md`, it wins.

## Spring Boot 4.x gotchas (this project uses 4.1.1 — newer than most training data)

Spring Boot 4 split what used to be one big `spring-boot-autoconfigure` jar into many
small per-feature modules, and moved to Jackson 3. Two things this broke in Phase 1,
worth remembering before assuming an old Spring Boot 3.x pattern still applies:

- **Flyway needs an extra dependency.** `org.flywaydb:flyway-core` alone does NOT pull
  in Flyway's Spring Boot integration anymore — you also need
  `org.springframework.boot:spring-boot-flyway` (contains
  `org.springframework.boot.flyway.autoconfigure.FlywayAutoConfiguration`). Without it,
  migrations silently never run (no error, no Flyway log lines at all — Hibernate just
  fails validation with "missing table"). Same pattern likely applies to other
  integrations added later (check for a matching `spring-boot-<feature>` module before
  assuming a plain third-party starter dependency is enough).
- **Jackson is "Jackson 3" here, not classic Jackson 2.** The `ObjectMapper` Spring MVC
  actually uses is `tools.jackson.databind.ObjectMapper` (groupId `tools.jackson.core`),
  not `com.fasterxml.jackson.databind.ObjectMapper`. The old `com.fasterxml.jackson.*`
  classes may still be on the classpath transitively (e.g. via `jjwt-jackson`) but only
  at `runtime` scope — importing them in application code compiles-fails. If you need to
  build/serialize JSON manually anywhere (e.g. a custom `AuthenticationEntryPoint` or
  exception handler), use the `tools.jackson.databind` package.
- Before assuming any other Spring Boot integration "just works" the old way, check
  `~/.m2/repository/org/springframework/boot/` for a same-named module, or just try
  running the app — errors here tend to be either a loud startup failure (missing
  bean/table) or a compile error, not a silent behavior change.

## Tech stack (decided)

- **Backend:** Spring Boot 4.1.1, Java 21, Maven — `backend/weekly-report-backend/`
- **Frontend:** React 19 + Vite 8 + TypeScript + Tailwind **4** + React Router **7** —
  `frontend/`. Read `frontend/README.md` before working there: Tailwind 4 is configured from
  CSS (no `tailwind.config.js`, no PostCSS), and `erasableSyntaxOnly` means no TS `enum`s,
  so backend enums are string-literal unions in `src/types/api.ts`.
- **Database:** MySQL, schema managed via **Flyway** migrations under
  `backend/weekly-report-backend/src/main/resources/db/migration/`
  (`V1__create_users_table.sql`, `V2__create_reports_schema.sql`; add one migration per
  phase as new entities are introduced). `ddl-auto=validate`, so a migration and its
  entities must match exactly — see the column table in `docs/PHASE2_SPEC.md` for the type
  choices that matter (DATE vs DATETIME(6), BIT(1) for booleans, VARCHAR(20) for enums) and
  keep every `@Size(max)` equal to its `@Column(length)` and its DDL length.
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

- **Dependency injection:** use `@RequiredArgsConstructor` (Lombok) on every
  `@Service`/`@Component`/`@RestController`/`@Configuration` class that only needs
  plain constructor injection of `final` fields — don't hand-write the constructor.
  The one exception is a class that needs real logic in its constructor beyond field
  assignment (e.g. `JwtService`, which takes `@Value`-annotated primitives and builds a
  `SecretKey`) — those keep an explicit constructor since Lombok can't express that.
  Never use field injection (`@Autowired` on a field).
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
