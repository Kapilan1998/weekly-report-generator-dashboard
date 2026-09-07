# Phase 2 Spec — Reports Domain & Review Workflow

**This file is the single authoritative spec for Phase 2.** Where it disagrees with
`docs/DATA_MODEL.md` or `docs/PLAN.md`, this file wins — those were drafted earlier and
left several points open. Every decision below was made deliberately; the "why" matters
because the live-coding round tests whether the author can defend them.

## Core lifecycle decision: lazy fork

A `Report` is the stable identity for "this user's report for this week". Its content
lives in `ReportVersion` rows.

- A version with `submitted_at IS NULL` is the **open working copy** — editable.
- A version with `submitted_at IS NOT NULL` is **frozen and immutable, forever.** No code
  path updates a frozen version or its children.
- Draft edits **mutate the open version in place**. A draft edited 10 times still has one
  version.
- **Submit** stamps `submitted_at` on the open version, freezing it.
- **Request changes** creates **no version** — it writes a `ReviewComment` and sets status
  to `NEEDS_CORRECTION`.
- The member's **first edit after a freeze** creates version `n+1`, populated directly
  from the request payload.

Why lazy rather than eagerly forking on request-changes:
1. The manager's entire write surface stays `{INSERT review_comments, UPDATE reports}` —
   "managers can only edit status/comment, never report content" becomes a property of the
   class graph rather than a promise. Eager forking would require the review service to
   write to all five content tables.
2. There is no deep-copy step at all (the new version is populated from the full-replace
   payload), removing the most bug-prone code in the alternative design.
3. `GET /versions` right after request-changes doesn't show a phantom empty version the
   member never touched.

Version numbers across a full cycle: create draft → v1 open; submit → v1 frozen; request
changes → still v1 (frozen), status `NEEDS_CORRECTION`; member edits → v2 open; resubmit →
v2 frozen; approve → still v2. Two versions, two review comments.

## Migration

One file only: `V2__create_reports_schema.sql`. Table names are **plural** (Hibernate's
default is singular, so every entity carries an explicit `@Table(name = "...")`).

## Authoritative column table

Rule applied everywhere: **VARCHAR length == `@Column(length)` == `@Size(max)`**, in all
three places. Hibernate's `validate` mode does *not* compare lengths, so a mismatch here
is not a startup error — it's a `Data truncation` 500 in production.

| Table | Column | Type | Null | Java |
|---|---|---|---|---|
| projects | id | BIGINT AI PK | no | `Long id` |
| | name | VARCHAR(120) UNIQUE | no | `String name` |
| | description | VARCHAR(500) | yes | `String description` |
| | active | BIT(1) | no | `boolean active` |
| | created_at | DATETIME(6) | no | `LocalDateTime createdAt` |
| reports | id | BIGINT AI PK | no | `Long id` |
| | user_id | BIGINT FK→users | no | `User user` (LAZY) |
| | project_id | BIGINT FK→projects | no | `Project project` (LAZY) |
| | week_start | DATE | no | `LocalDate weekStart` |
| | week_end | DATE | no | `LocalDate weekEnd` |
| | status | VARCHAR(20) | no | `ReportStatus status` |
| | last_submitted_at | DATETIME(6) | yes | `LocalDateTime lastSubmittedAt` |
| | created_at / updated_at | DATETIME(6) | no | `LocalDateTime` |
| report_versions | id | BIGINT AI PK | no | `Long id` |
| | report_id | BIGINT FK→reports | no | `Report report` (LAZY) |
| | version_number | INT | no | `Integer versionNumber` |
| | tasks_planned_next_week | VARCHAR(4000) | yes | `String` |
| | notes | VARCHAR(4000) | yes | `String` |
| | links | VARCHAR(1000) | yes | `String` |
| | submitted_at | DATETIME(6) | yes | `LocalDateTime submittedAt` |
| | created_at / updated_at | DATETIME(6) | no | `LocalDateTime` |
| task_entries | report_version_id | BIGINT FK | no | `ReportVersion` (LAZY) |
| | display_order | INT | no | `Integer displayOrder` |
| | task_name | VARCHAR(255) | no | `String` |
| | priority / status | VARCHAR(20) | no | `TaskPriority` / `TaskStatus` |
| | planned_percent / actual_percent | INT (0-100) | no | `Integer` |
| | time_planned_hours / time_spent_hours | DECIMAL(5,2) | no | `BigDecimal` |
| | output_deliverable | VARCHAR(500) | yes | `String` |
| blockers | report_version_id | BIGINT FK | no | `ReportVersion` (LAZY) |
| | display_order | INT | no | `Integer` |
| | description | VARCHAR(1000) | no | `String` |
| | key_issue | BIT(1) | no | `boolean keyIssue` |
| achievements | report_version_id | BIGINT FK | no | `ReportVersion` (LAZY) |
| | display_order | INT | no | `Integer` |
| | description | VARCHAR(1000) | no | `String` |
| | key_achievement | BIT(1) | no | `boolean keyAchievement` |
| hours_entries | report_version_id | BIGINT FK | no | `ReportVersion` (LAZY) |
| | task_type | VARCHAR(20) | no | `TaskType` |
| | hours | DECIMAL(5,2) | no | `BigDecimal` |
| review_comments | id | BIGINT AI PK | no | `Long id` |
| | report_version_id | BIGINT FK | no | `ReportVersion` (LAZY) |
| | reviewer_id | BIGINT FK→users | no | `User reviewer` (LAZY) |
| | action | VARCHAR(20) | no | `ReviewAction action` |
| | comment | VARCHAR(2000) | yes | `String` |
| | created_at | DATETIME(6) | no | `LocalDateTime` |

Deliberate exclusions:
- **No denormalized aggregate columns** (`task_count`, `total_hours_spent`, …). Phase 3's
  dashboard computes its aggregates; pre-denormalizing here would add columns that must be
  kept in sync on every write for no Phase 2 benefit.
- **No `lock_version`** — concurrency is pessimistic (below), so there is no `@Version`
  field and therefore no column.

Type choices that matter under `ddl-auto=validate` (Hibernate 7.4 + MySQL 8):
- `LocalDate` → `DATE`; `LocalDateTime` → `DATETIME(6)`. Mixing these fails startup.
- `boolean` → `BIT(1)` (MySQLDialect maps BOOLEAN to `bit`, not `tinyint(1)`).
- Enums → `@Enumerated(STRING)` + `VARCHAR(20)` + `@Column(length = 20)`. A native MySQL
  `ENUM(...)` column **fails** validation (Connector/J reports it as `CHAR`).
- All timestamps are `DATETIME(6)`, not plain `DATETIME`: second-resolution timestamps make
  "latest comment" ordering non-deterministic when a seed script or a double-click writes
  two rows in the same second. Every comment query also orders `created_at DESC, id DESC`.

`reports` has no `current_version_id` FK pointer — the current version is
`MAX(version_number)` for the report, resolved by
`findTopByReportIdOrderByVersionNumberDesc`. This avoids a circular FK between `reports`
and `report_versions`, which InnoDB handles unreliably (cascades within an FK cycle can
degrade to RESTRICT, breaking teardown in seeding and tests).

`uq_reports_user_week (user_id, week_start)` enforces one report per user per week.
`week_start` is **normalized server-side** to the Monday of that ISO week
(`previousOrSame(MONDAY)`), with `week_end = week_start + 6 days` — normalizing rather than
rejecting non-Mondays is what makes that constraint unbypassable by construction.

## Endpoints

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | /api/projects | authenticated | active projects only, `{id, name}` |
| POST | /api/reports | owner | create draft → 201 |
| PUT | /api/reports/{id} | owner | edit while DRAFT/NEEDS_CORRECTION |
| POST | /api/reports/{id}/submit | owner | DRAFT/NEEDS_CORRECTION → SUBMITTED |
| GET | /api/reports/mine | authenticated | own history, paginated |
| GET | /api/reports/{id} | owner or MANAGER | detail |
| GET | /api/reports/{id}/versions | owner or MANAGER | submitted versions only |
| GET | /api/reports/{id}/versions/{n} | owner or MANAGER | one submitted version |
| GET | /api/reports | MANAGER | team-wide, paginated + filtered |
| GET | /api/reports/week-status | MANAGER | one row per user incl. NOT_STARTED |
| POST | /api/reports/{id}/approve | MANAGER, not owner | SUBMITTED → APPROVED |
| POST | /api/reports/{id}/request-changes | MANAGER, not owner | SUBMITTED → NEEDS_CORRECTION |

`/api/reports/week-status` exists because the PDF's Section 4 filter list includes
**"not yet started"** as a fifth status — that is the *absence* of a report row for a
(user, week) pair, so no predicate on `reports` can express it. It's a `LEFT JOIN` from
users.

Write paths are gated by `isAuthenticated()` plus a service-layer ownership check, **not**
by `hasRole('TEAM_MEMBER')` — the PDF opens Section 2 with "Every user must have their own
dedicated page for creating and managing their weekly reports", so a manager must be able
to file their own report. Self-approval is blocked separately: approve/request-changes on
a report you own returns 403.

## Authorization rules

Role checks alone are insufficient: two team members share the same role, so ownership is
a separate check.

1. **Guard order is fixed: visibility/ownership first, workflow state second.** Reversing
   it turns the state guard into an oracle — "409 Report is APPROVED" for a real id vs
   "404" for a fake one tells an attacker both that the report exists and what state it's
   in.
2. **A peer's report is always 404**, never 403, with a message identical to a genuinely
   missing id — 403-for-exists vs 404-for-missing is an id-enumeration oracle. 403 is
   reserved for role-gate rejections (`@PreAuthorize`) and for a manager opening another
   user's `DRAFT`.
3. **A manager never sees unsubmitted content.** Manager-facing content reads resolve the
   latest *submitted* version; `/versions` filters `submitted_at IS NOT NULL` for both
   roles; `/versions/{n}` 404s for an unsubmitted one. The owner sees their working copy
   via `GET /api/reports/{id}`.
4. Managers cannot reach any content-writing code path at all — `ReportReviewService` has
   no write access to version or child tables.
5. **Filter DTOs are split**: `MyReportFilterRequest` has no `userId` component at all, so
   `GET /api/reports/mine?userId=<someone-else>` cannot bind it. (A shared DTO would bind
   it and rely on the service remembering not to read it.)
6. **Sort properties are whitelisted** by exact, full dotted path. Spring Data resolves a
   dotted `Sort` property into a JOIN and will order by any mapped attribute, so an
   unvalidated `?sort=user.passwordHash,asc` is a blind data-extraction channel, not a
   typo. Non-whitelisted → 400.
7. Error responses never echo attacker input or internals — no `ex.getMessage()`
   pass-through for type-mismatch, malformed-JSON, or data-integrity errors (MySQL's
   message would disclose the constraint name, table, and the duplicate key *value*).

## Status codes

| Situation | Code |
|---|---|
| Bean-validation failure | 400 |
| Malformed JSON / bad param type / bad sort property | 400 |
| No or invalid JWT | 401 |
| Role gate; manager on another user's DRAFT; self-review | 403 |
| Peer's report, missing report, unsubmitted version | 404 |
| Duplicate report for a week; illegal transition; incomplete submit; retagging project after submission | 409 |

409 is used for *all* submit refusals so the frontend has a single branch.

## Concurrency

Pessimistic: `@Lock(LockModeType.PESSIMISTIC_WRITE) findWithLockById(Long id)`, declared on
`ReportRepository` (a `@Lock` on inherited `findById` has no effect), acquired by **all
five** mutating paths — create, edit, submit, approve, request-changes — inside the same
`@Transactional`.

Locking only the three status transitions and not the edit path would leave this race: the
member's PUT is midway through replacing v2's children while the submit call stamps
`submitted_at` on v2 — producing a "frozen" snapshot whose rows changed after submission,
which is exactly the audit-trail corruption the assignment grades.

## Child-collection replacement

Edit is **full replace**: the payload carries the complete task/blocker/achievement/hours
lists, and the service clears and re-adds. Merge-by-id would let a client smuggle a child
id belonging to another report's version.

`display_order` is assigned by the service from the incoming list index — without it, row
order would depend on auto-increment ids. `hours_entries` needs no order column; the fixed
`TaskType` enum order is applied in the mapper.

Consequence to carry into Phase 5: child row ids change on every save, so the React form
must key rows by array index or a client-generated id, never by the server id, or every row
remounts on save and loses focus.

## Dashboard aggregate rules (settled in Phase 3)

- **Every aggregate over report content is restricted to the report's current version**
  (`versionNumber = max(versionNumber) for that report`). Tasks, blockers and hours hang off
  a *version*, so without this a report that went through one correction cycle contributes
  its content twice. Verified: the week holding a corrected report reports 2 completed tasks,
  not 3.
- **"Open blocker"** — the brief asks for "open blockers across the team" but blockers have no
  `resolved` column, so it is defined as: *a blocker on the current version of a report whose
  status is not `APPROVED`*. Approving a report closes its blockers along with it. Changing
  this means changing `BlockerRepository.countOpen` and this line together.
- **Compliance** is `submitted / teamSize` for the selected week, where "submitted" means
  `lastSubmittedAt != null` (filed at least once, even if later sent back). The parts —
  submitted / draft / not started — are returned separately so the UI can show them as the
  brief words it, rather than re-deriving them from a percentage.
- **`needsCorrection` and `openBlockers` are not week-scoped.** Both are current-state counts
  ("reports *currently* in Needs Correction"), so filtering them by week would answer a
  different question than the brief asks.
- **A project cannot be deleted once any report references it** — that would strip the tag off
  historical reports and rewrite a reviewed version's context. `DELETE` returns 409 naming the
  report count; retiring such a project is done by setting `active = false`, which removes it
  from the report form's options while leaving history intact.

## Other locked decisions

- **Unknown JSON properties are rejected** (400). The PDF says users "should not be able to
  customize, reorder, or add their own fields" — strict deserialization is the cheapest
  demonstration of that, and it also turns any attempt to smuggle `status` or `userId` into
  a payload into a loud failure instead of a silent drop.
- **Projects are resolved with `findByIdAndActiveTrue`** on create and edit, so `active` is
  enforced rather than decorative.
- **The project tag freezes once anything is submitted** — changing `projectId` after any
  version is frozen returns 409. Otherwise retagging would retroactively change the context
  of an already-reviewed version, which leaks straight through the "previous version must
  remain visible" requirement.
- **At most one key blocker and one key achievement** per version — validated in the
  service, since it's a cross-item rule a field annotation can't express.
- **Submit requires completeness**: at least one task entry and non-blank
  "tasks planned next week". A draft may be blank; a submission may not.
- `spring.jpa.open-in-view=false` with `@Transactional(readOnly = true)` on read paths and
  all entity→DTO mapping inside it. OSIV defaults to on, which hides lazy-loading bugs
  until they surface somewhere far less convenient.
- `ReviewAction` is `{APPROVE, REQUEST_CHANGES}` — deliberately *not* `APPROVED`, which
  would collide confusingly with `ReportStatus.APPROVED` in the same mappers.
- `UserSummaryResponse` carries `{id, name}` only. Embedding `email` would ship every team
  member's address on every row of the manager's list.
- Specification factories return `Specification.unrestricted()` when a filter is absent.
  Returning `null` was the Spring Data JPA 3.x idiom; on 4.1.1 `Specification.and`/`where`
  assert non-null and `findAll(null, pageable)` NPEs, so an omitted filter would 500.
- Default sort is `weekStart DESC, id DESC`, and `id DESC` is appended to any
  client-supplied sort. Without the tiebreaker, paging over a team that all filed the same
  week skips and duplicates rows between pages.
- V2 seeds 5 projects. Without them there is no valid `projectId` in the system and no
  Phase 2 endpoint chain can be exercised at all.
