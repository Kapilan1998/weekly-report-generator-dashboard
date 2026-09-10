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

## Phase 3 — Backend: Projects & dashboard aggregates ✅ done (branch `feature/dashboard-api`)

No migration needed — `projects.active` already existed and "open blocker" is defined without
a new column. See the "Dashboard aggregate rules" section of `docs/PHASE2_SPEC.md` for the
definitions these endpoints settled.

- [x] `Project` CRUD: `GET /api/projects` (any authenticated, active only — feeds the report
      form), `GET /api/projects/all` (MANAGER, includes inactive + report counts),
      `POST` / `PUT` / `DELETE` (MANAGER). Names are unique case-insensitively; a project any
      report references cannot be deleted (409 naming the count) and is retired by setting
      `active = false` instead
- [~] `ProjectMember` assignment endpoints — **deliberately skipped.** Marked optional in both
      the brief and this plan, and it was already removed from the ER diagram in Phase 2
- [x] `GET /api/dashboard/summary?weekStart=` — team size, submitted / draft / not-started,
      compliance %, reports currently needing correction, open blockers
- [x] `GET /api/dashboard/charts?weekStart=&weeks=` — tasks-completed trend (zero-filled),
      status by member (every user, including those with no reports), workload by project
      (report count + hours), hours by task type (all five, in enum order)
- [x] `GET /api/dashboard/activity?limit=` — submissions and review actions merged into one
      reverse-chronological feed

Verified with a 48-check suite: project CRUD incl. duplicate-name and delete-in-use rules,
week normalisation, every RBAC gate (a team member gets 403 on all of it), and parameter
bounds. **Also verified the current-version restriction**: the week holding a corrected report
counts 2 completed tasks rather than 3, and its hours match v2 rather than v1+v2 — the bug
that would have silently inflated every chart.

### Phase 3b — User administration ✅ done (branch `feature/dashboard-api`, on top of Phase 3)

Not in the original plan: found when scoping Phase 6, which needs a user-management page the
brief requires but no endpoint existed for. It is also how a manager account gets created —
until now that only happened via raw SQL, which would have been awkward in the demo video.

- [x] `V3__add_user_enabled.sql` — adds `users.enabled`, defaulting existing rows to enabled
- [x] `GET /api/users`, `POST /api/users` (create with an initial password and a role),
      `PUT /api/users/{id}` (assign role, enable/disable), `DELETE /api/users/{id}` —
      all MANAGER-only at the class level
- [x] Three guards, each blocking a change that is hard or impossible to undo: nobody may
      change their own role or disable themselves; no change may leave zero enabled managers;
      a user who has filed reports cannot be deleted, only disabled
- [x] `enabled` wired into all three places that matter — `CustomUserDetails.isEnabled()`,
      the JWT filter (which builds its own `Authentication`, so nothing else would apply it)
      and `AuthService.login` (which checks the password directly, bypassing Spring's own
      checks). Disabling therefore revokes access immediately rather than at token expiry
- [x] A disabled login fails with the same generic "Invalid email or password" as a wrong
      password — saying "this account is disabled" would confirm the address exists

Verified with a 38-check suite: RBAC on every endpoint, create/role-assignment rules, all
three guards, and that a disabled account's **existing token stops working at once** (401)
as well as being unable to sign in again.

Fixed while here: out-of-range or missing request parameters returned **500** instead of 400.
`@Min`/`@Max` on a `@RequestParam` throws `ConstraintViolationException`, and a missing param
throws `MissingServletRequestParameterException` — neither was handled, so the catch-all
swallowed them. Both now return 400.

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

## Phase 5 — Frontend: report pages ✅ done (branch `feature/report-pages`)
- [x] Personal weekly report page (create/edit) at `/reports/new` and `/reports/:id/edit` —
      the fixed field set, the 8-column task table **in the PDF's column order** (which
      differs from the `TaskEntry` declaration order), blocker/achievement key flagging,
      hours breakdown
- [x] Report history page — rows now open the report, plus a "New report" action
- [x] Report detail/view page at `/reports/:id`, shared by both roles
- [x] Manager comment shown prominently when Needs Correction, attributed to the reviewer
      with the version it was made against
- [x] Past-versions list on the detail page, loaded on demand, each version openable with
      the review made against it
- [x] Client-side validation in two tiers: structural rules (mirroring the backend's bean
      validation, applied even to a draft save) and submit-only completeness rules

Implementation notes worth keeping:
- Numeric form fields are held as **strings**, converted only at serialise time. An empty
  `<input type="number">` reads as `''` and `Number('')` is `0`, so number-typed state would
  silently post a valid-looking `0` for a field the user never filled in.
- Task/blocker/achievement rows are keyed by a **client-generated id**, never the server's
  child id — the backend replaces child rows on every save, so server ids change each time
  and React would remount every row, dropping focus mid-typing.
- Key issue / key achievement use **radio semantics**, so "at most one" is structurally
  impossible to violate rather than merely validated, with an explicit Clear affordance since
  a radio can't be unset by re-clicking.
- The week is a static field on edit (the update payload carries no `weekStart`), and the
  project select locks once `lastSubmittedAt` is set (the backend's own predicate for
  refusing a retag).
- `Submit` renders only when `editable && content.submittedAt === null`. Right after a
  request-changes the current version is still the frozen one, and the backend would refuse
  with "no changes have been made since the last submission".
- All four child arrays are always sent — the update DTO has no `@NotNull` on them, so an
  omitted array is accepted and would silently wipe that section.

Verified in a browser end to end: created a report dated Wednesday Oct 14 and it filed as
Oct 12–18 (server-side Monday normalisation mirrored client-side), submitted it, had the
manager request changes, saw the attributed correction banner, edited it (forked to v2),
**confirmed v1 still renders its original single task and 21.50h while v2 shows two tasks and
26.00h**, then resubmitted. Zero console errors, clean build and lint, mobile layout checked
at 390px.

## Phase 6 — Frontend: manager dashboard & remaining pages ✅ done (branch `feature/manager-pages`)
- [x] Team dashboard: all four filters (member, project, week range, multi-select status)
      plus the report list, with a Review shortcut on every reviewable row
- [x] Manager review page at `/review/:reportId`: one form with an outcome switch —
      Approve (optional note) / Request changes (required comment) — the previous decision,
      the full content and the version history
- [x] Team member profile page at `/team/:userId` (status stats + full paginated history)
- [x] Project/category management page at `/projects` (list + create/rename/deactivate/
      delete, editor as a page panel rather than a modal)
- [x] User management page at `/admin/users` (add account, assign role, disable/enable,
      delete)
- [x] Summary tiles + a compliance breakdown bar + four charts — **built without a
      charting library**; see the decision in `docs/ARCHITECTURE.md`
- [x] Bonus: side-by-side single-section view at `/team/sections` — pick a week and a
      section (blockers, achievements, planned, tasks, hours, notes) and read it across
      every team member at once

**Decisions worth knowing before changing these pages:**
- **The team dashboard keeps all of its state in the URL** (week, chart window, every
  filter, page number). That is what makes the "Needs correction" tile a plain link into
  the same page with the filter applied, and it makes a filtered view shareable. Filter
  changes `replace` the history entry so Back leaves the page rather than replaying clicks.
- **Fetched data is stored with the parameters it was fetched for** (`src/lib/keyed.ts`),
  so "still loading" is derived during render. Clearing state at the top of the fetch
  effect was the alternative and it is worse twice over: an extra render pass on every
  change, and one frame where last week's numbers sit under the new week's heading. It also
  covers URL changes that come from a link or the Back button, where no handler of ours runs.
- **The review panel is gated on `report.reviewable` alone** — the backend already computes
  "manager, not the author, status Submitted". Re-deriving it here would be a second copy.
- **What the backend refuses, the UI doesn't offer.** Delete appears on a project or account
  only when its report count is zero; a manager's own row has no role select and no disable
  button. The last-enabled-manager rule can't be predicted from a single row, so that one
  surfaces as the backend's message.
- **`/team/sections` is N+1 requests by design** — list the week's reports, then fetch each
  detail — because no endpoint returns one section across the team. N is the size of a team
  and the fetches are parallel. Other people's drafts are filtered out before fetching
  (a manager may not read them) and the number skipped is shown, since a silently short
  list would read as "nobody had blockers".
- **Member status counts come from four `size=1` queries** reading `totalElements`, not from
  fetching every report and counting. Exact at any history size.

Verified in a browser against the live backend, end to end: approved a submitted report and
watched the status, banner and panel change, then the "already approved" state on reload;
the empty-comment guard on Request changes; project create → duplicate-name 409 inline on
the name field → rename → deactivate → delete; account create with all three validators
firing, role promote/demote, disable (and confirmed the disabled account's login then
fails 401) and delete; the summary tile deep-link applying its filter (8 of 8); Monday
normalisation in the range filter (picked a Wednesday, URL got that week's Monday); a
member's four status counts summing exactly to the pagination total (4+5+4+3 = 16); the
section view including its private-draft notice. Team-member RBAC re-checked directly
against the API: **403 on all seven manager reads and on every write with a valid body,
with nothing created.** Zero console errors, clean `tsc -b`, zero lint warnings, mobile
layout checked at 390px. Every test artifact was removed — the database is byte-for-byte
as it was found.

### Found in a later audit and fixed (branch `feature/manager-pages`)

- **The status filter had no "not started".** The brief lists it alongside the four real
  statuses. It isn't one — it is the absence of a report row for the selected week, so the
  report list cannot return it — so it is a separate chip that swaps the list for the roster
  of members who haven't filed, built from the `week-status` rows the "Filed this week"
  panel already fetched. Mutually exclusive with the status chips, because the two answers
  come from different queries and can't be unioned into one page. Only the member filter
  carries over: a report that was never filed has no project and no date to filter on.
- **A duplicate-week 409 showed as a detached banner.** It carries no `fieldErrors`, so it
  fell through to the generic banner. It now lands on the week input, and the existing report
  is looked up so "you already have one" comes with a link to open it.
- **`&apos;` inside a JavaScript string** rendered literally in the submit-blocked banner —
  an HTML entity in a JS string is just those six characters.
- **The password field on the user-management page sat outside a `<form>`**, so password
  managers ignored it, Enter didn't submit, and Chrome logged a warning. It is a real form now.
- **Duplicate member names were indistinguishable** in the dashboard's member filter. Where
  a name is not unique the email is appended; unique names stay clean.

## Phase 7 — Seed data ✅ done (branch `feature/manager-pages`)
- [x] `seed/DemoDataSeeder.java` — an `ApplicationRunner` creating 2 managers, 4 team
      members and six weeks of reports across every status, including one report with two
      versions from a full correction cycle. 21 reports, 22 versions, 18 review comments.

**Why a loader and not a Flyway seed migration.** A migration has to hardcode absolute week
dates, and the dashboard opens on the *current* week — run the project a month after those
dates were written and it greets you with an empty dashboard. Every week here is computed
relative to today. It also means passwords are hashed by the real `PasswordEncoder` instead
of being pasted in as pre-computed digests.

**Guards.** It runs only when the `users` table is empty, so it is safe on every restart and
can never write over data someone entered. `--app.seed.enabled=false` turns it off (the tests
set that). To reload it, drop the schema and restart.

**It goes through the same states the API does** — content written to a version, submit
freezes that version, request-changes adds a comment and no version, the next edit forks the
version after it. Hand-assembling the rows would have been shorter but could produce shapes
the real endpoints never produce (a frozen version whose children changed, a
NEEDS_CORRECTION report with an unfrozen current version), and the dashboard aggregates
assume otherwise.

The current week is arranged so every part of the dashboard has something to show: Priya has
a report **waiting for review**, Daniel one **waiting on its author** with the manager's
comment on it, Sofia a **draft**, and Liam **nothing at all** — which is what makes the
compliance rate and the "not started" filter show something other than 100%.

Verified against a throwaway schema (never the development database): all four statuses
present, Sofia's previous-week report holding v1 with 2 tasks and no blockers next to v2 with
4 tasks and 2 blockers, each review comment attached to the version it was made against, and
**the trend chart counting 12 completed tasks for that week rather than 14** — i.e. the
current-version rule holding on seeded data too.

## Phase 8 — Testing ✅ done (branch `feature/manager-pages`)
- [x] `security/RoleBasedAccessControlTest.java` — 12 integration tests through the real
      filter chain.
- [x] **Mockito unit tests for every controller and every service** — 172 of them, no Spring
      context, one class per production class:
      `AuthControllerTest`, `DashboardControllerTest`, `PingControllerTest`,
      `ProjectControllerTest`, `ReportControllerTest`, `UserControllerTest`,
      `ReportSortWhitelistTest`, `AuthServiceTest`, `DashboardServiceTest`,
      `ProjectServiceTest`, `ReportAccessGuardTest`, `ReportReviewServiceTest`,
      `ReportServiceTest`, `UserAdminServiceTest`.
- [x] `./mvnw test` runs **185 tests green**.

The two layers test different things and neither replaces the other. The controller tests
assert only what a controller decides — which service method, which arguments, which status
code — because that is all a controller does. The service tests are where the rules live:
week normalisation, the lazy version fork, the three user-administration guards, compliance
arithmetic, chart zero-filling. `RoleBasedAccessControlTest` stays because RBAC is a property
of the filter chain and the method-security proxy, and a mocked test cannot observe either.

Worth knowing when editing these:
- `MockitoExtension` is **strict** by default, so an unused stub fails the test. Stub inside
  the test method, not in a shared setup, unless every test needs it.
- A fake `save` that echoes its argument back leaves the id null, and the service then looks
  the row up by that id. `ReportServiceTest.stubSaveAssigningAnId` assigns one, which is what
  identity generation really does.
- `ReportReviewServiceTest` ends with a reflection assertion on the service's field list. It
  is deliberate: "a manager cannot rewrite report content" holds because that class has no
  dependency capable of writing content, and the test is there to make anyone who adds one
  stop and justify it.
- [x] **Test database decided: a dedicated local MySQL schema**
      (`weekly_report_dashboard_test`, created automatically), configured in
      `src/test/resources/application-test.properties` as a short diff over the main
      properties. H2 was ruled out — V2 uses `BIT(1) DEFAULT b'1'`, MySQL `CHECK`
      constraints and MySQL types, and with `ddl-auto=validate` the real migrations run in
      every `@SpringBootTest` context, which H2's compatibility mode does not survive.
      Testcontainers was ruled out because it needs Docker, which the README does not
      otherwise require; anyone who followed the README already has MySQL.
- [x] `WeeklyReportBackendApplicationTests` moved onto the test profile too — without it,
      `mvnw test` ran Flyway against the development database.

What the suite asserts, beyond the brief's minimum:
- a peer's report is **404, not 403**, and so is a nonexistent id — ids can't be enumerated
- a peer's **approved** report is also 404, which pins ownership-before-status ordering
- all seven manager-only reads → 403 for a team member
- all manager-only writes → 403 **with valid bodies** (an invalid body is rejected at
  argument binding, before method security, and would pass for the wrong reason)
- unauthenticated → 401, not Spring Security's bare 403
- registration cannot mint a manager (the Phase 1 vulnerability, kept nailed down)
- a manager may read a peer's *submitted* report but not their *draft*
- a manager cannot review their own report
- `?sort=user.passwordHash` → 400 on both list endpoints, and a whitelisted property still works
- disabling an account invalidates an **already-issued token** on the next request
- `/api/reports/mine?userId=<someone-else>` returns your own history, because the endpoint
  declares no such parameter to bind

Tokens come from the real `/api/auth/login`, not `@WithMockUser`: `JwtAuthFilter` builds its
own `Authentication` (including the `enabled` check), so a mocked principal would skip the
exact code these tests are about.

**Spring Boot 4 gotcha hit here:** `@AutoConfigureMockMvc` has moved from
`org.springframework.boot.test.autoconfigure.web.servlet` to
`org.springframework.boot.webmvc.test.autoconfigure`.

## Follow-up — self-service profile editing ✅ done (branch `feature/ai-assistant`)

`/profile` used to be read-only and said so: there was no endpoint for "change my own name or
password", because `/api/users` is manager-only. There is one now.

- [x] `PUT /api/profile` — own name and email
- [x] `PUT /api/profile/password` — own password, current password required
- [x] `ProfileService` + `ProfileController`, `ProfileServiceTest` (11) and
      `ProfileControllerTest` (6), plus 2 integration tests in `RoleBasedAccessControlTest`
- [x] Frontend: `api/profile.ts`, `features/profile/EditProfileForm`,
      `features/profile/ChangePasswordForm`, wired into `ProfilePage`

**A separate controller, not a `/me` path on `UserController`.** That class carries
`@PreAuthorize("hasRole('MANAGER')")` at the class level, so anything added to it would be
manager-only and a team member could not edit their own name. The two also have opposite
subjects — `/api/users` acts on *other people's* accounts, `/api/profile` only ever on your
own — and `ProfileControllerTest` asserts the absence of a class-level role gate, so copying
that annotation across fails a test rather than silently removing the feature.

**Both endpoints return a whole `AuthResponse`, and the client must call `signIn` with it.**
The JWT's subject is the email (`JwtService.generateToken`). Change the email and the token in
the caller's hands names a user that no longer resolves, so their next request 401s and the
client signs them out — editing your email would look like being logged out at random.
Returning a freshly signed token is what prevents that. Verified live: after an email change,
`/reports` still loads.

**A wrong current password is 400, not 401.** `api/client.ts` runs the unauthorized handler on
any 401, so the obvious status would end the session over a typo in a form field. There is a
test on the status specifically, in the service test and again in the RBAC suite.

**Two things the endpoint deliberately cannot do.** `UpdateProfileRequest` has no role
component, and `fail-on-unknown-properties=true` means sending one is a 400 rather than a
silently ignored field — a team member must not be able to promote themselves through an
endpoint every signed-in user can reach. And the uniqueness check is skipped when the
normalised email is unchanged; without that, the row collides with itself and every plain
rename returns 409.

**A password change signs out the account's other devices.** It bumps
`users.token_version` (migration `V4`), which invalidates every token already issued for the
account; the token returned to the caller carries the new version, so the session that made
the change survives. The version is bumped by a role or enabled change too — see
`JwtAuthFilter`.

## Follow-up — week picker ✅ done (branch `feature/ai-assistant`)

- [x] `components/WeekField.tsx` replaces `<input type="date">` in all four places a week is
      chosen: the report form, the dashboard header, and both ends of the filter range

**Chrome's date popup cannot be themed.** It is painted by the browser outside the document,
so on this dark theme it opened as a white panel in the browser's own blue — no stylesheet
can reach it. That alone forces a custom control if the picker is to match the app.

**It picks a week, which is what the app stores.** A date input offers a day; all four callers
piped the value through `mondayOf` and threw the day away. Each row in `WeekField` is one
Monday–Sunday week: hovering lights the whole row, clicking anywhere in it selects that week.
The normalisation the native input hid behind a silent snap is now the visible behaviour of
the widget.

**Rendered through a portal, for clipping rather than stacking.** `Card` sets
`overflow-hidden` for its rounded corners, and `animate-fade-up` leaves a settled `transform`
on the section wrapper — a transformed ancestor becomes the containing block for
`position: fixed`, so even fixed positioning would be trapped inside the card. A portal to
`document.body` has neither ancestor. Verified in the hardest case: the report form's field
is inside a `Card` inside an animated section, and the panel escapes both.

**Two pieces of state, not one.** The visible month and the focused week move independently.
Deriving the month from the focused week looks tempting and is wrong: stepping a month back
from 3 Oct gives 3 Sep, whose Monday is 31 Aug, so the grid would jump to August and skip
September. Arrow keys move by week and pull the month along when focus walks off the grid.

Keyboard: `↓` on the trigger opens, `↑↓←→` move by week, `PageUp`/`PageDown` by month, `Home`
jumps to the current week, `Enter` selects, `Escape` closes — focus returns to the trigger
either way. A roving tabindex keeps the grid to one tab stop instead of six.

## Phase 9 — Bonus (optional, do last)
- [x] **AI Chat Assistant ✅ done** (branch `feature/ai-assistant`) — Gemini via function
      calling. Full write-up in `docs/AI_ASSISTANT.md`, written to be lifted into the
      presentation, which the brief requires for this feature.

Both capabilities the brief lists: conversational Q&A (`POST /api/assistant/chat`, a
tool-use loop) and a written weekly summary (`POST /api/assistant/summary`, a single call
over a digest). Chat widget in the app shell, "Week in review" card on the dashboard.

**Approach: tool use, not RAG.** Four read-only tools, each wrapping an existing service.
Retrieval by similarity suits prose you cannot query; this data is relational and already has
exact query paths, so embedding it would make precise questions answerable only
approximately and add an index to keep in sync with every edit.

**Authorization is inherited, not re-implemented.** `get_report_content` goes through
`ReportService.getDetail` → `ReportAccessGuard`, so the assistant cannot read a peer's draft —
verified live: it answers *"Report 2 is still a draft, so its content is private to its author"*.
Had the tools reached for repositories directly, the assistant would have become a way to read
what the API forbids.

**No write tools, deliberately.** Report text enters the model's context as tool output, so a
member could write "ignore your instructions" in a blocker. With no write tools the worst case
is a wrong *answer*, never a wrong *action* — structural, not a filter.

Three things found by testing rather than reading docs:
- **Thought signatures.** Each `functionCall` part arrives with a sibling `thoughtSignature`
  that must be echoed back verbatim, or the next request is a 400. A single-turn test never
  reveals it. It is why the conversation is carried as opaque maps rather than typed records.
- **No outer transaction.** A refused tool call throws inside a nested `@Transactional`
  service, marking the *shared* transaction rollback-only — so catching it isn't enough and
  the commit fails with `UnexpectedRollbackException`, turning a handled refusal into a 500.
  It also avoids holding a pooled connection across model latency.
- **Free tier is 20 requests per day per model.** Switching model resets it, since the quota
  is per model. `gemini-2.5-flash` is retired for new users; settled on
  `gemini-3.1-flash-lite`, pinned rather than a `-latest` alias so a recorded demo and a later
  review behave the same.

Optional throughout: with no key the status endpoint reports `configured: false`, the widget
renders a disabled control explaining why, and the rest of the application is unaffected.
- [ ] Deployment (publicly accessible instance)

## Phase 10 — Deliverables wrap-up
- [x] Root README rewritten: current status, the four setup steps, the demo accounts table,
      a five-minute reviewer tour, how to reload the demo data, how to run the tests, and a
      "what to look at first" section. It previously told you to run raw SQL to create a
      manager — which the user-management page now does, and which the brief's video
      instructions rule out on camera anyway.
- [x] ER diagram exported to `docs/diagrams/er-diagram.svg`, generated by
      `docs/diagrams/generate_er_diagram.py` so it can be regenerated when a migration adds
      a column rather than hand-edited. Fixed three errors the Mermaid copy in
      `docs/DATA_MODEL.md` had accumulated: `planned_pct`/`actual_pct` (really
      `planned_percent`/`actual_percent`), the missing V3 `enabled` column, and missing
      `display_order` columns.
- [ ] Verify the README against a genuinely clean checkout (fresh clone, empty MySQL)
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
