# Data Model

Status: **implemented as of Phase 2.**

> **`docs/PHASE2_SPEC.md` is the authoritative reference** for the exact tables, column
> types, and lifecycle rules — it is what the code and the `V2__create_reports_schema.sql`
> migration were built from, and it resolves several points this file left open. Read that
> first; this file is the conceptual overview and the basis for the ER diagram deliverable.

Export a diagram image from this (dbdiagram.io, drawio, or a Mermaid render) and save it
under `docs/diagrams/` for the assignment's ER-diagram deliverable. Note the shape below
differs from the shipped schema in two ways, both deliberate:
- `PROJECT_MEMBER` is **not implemented** — assigning members to projects is optional in the
  brief and is deferred to Phase 3. Drop it from the exported diagram, or implement it
  first; the graded diagram must not show a table the database doesn't have.
- `REPORT` has **no `current_version_id`** column. The current version is the highest
  `version_number`, which avoids a circular FK between `reports` and `report_versions`.

## Entity-relationship overview

```mermaid
erDiagram
    users ||--o{ reports : "files"
    users ||--o{ review_comments : "reviews as manager"
    projects ||--o{ reports : "categorises"
    reports ||--o{ report_versions : "keeps history of"
    report_versions ||--o{ task_entries : "lists"
    report_versions ||--o{ blockers : "lists"
    report_versions ||--o{ achievements : "lists"
    report_versions ||--o{ hours_entries : "breaks down"
    report_versions ||--o{ review_comments : "was reviewed by"

    users {
        BIGINT id PK
        VARCHAR_255 name
        VARCHAR_255 email UK
        VARCHAR_255 password_hash
        VARCHAR_20 role "TEAM_MEMBER | MANAGER"
        BIT_1 enabled "V3 - a retired account, kept for its authorship"
        INT token_version "V4 - bumped to revoke this account's tokens"
        DATETIME created_at
    }

    projects {
        BIGINT id PK
        VARCHAR_120 name UK
        VARCHAR_500 description "nullable"
        BIT_1 active "false retires it; reports still reference it"
        DATETIME_6 created_at
    }

    reports {
        BIGINT id PK
        BIGINT user_id FK
        BIGINT project_id FK
        DATE week_start "UK with user_id - one report per user per week"
        DATE week_end "always week_start + 6"
        VARCHAR_20 status "DRAFT | SUBMITTED | NEEDS_CORRECTION | APPROVED"
        DATETIME_6 last_submitted_at "nullable until first submit"
        DATETIME_6 created_at
        DATETIME_6 updated_at
    }

    report_versions {
        BIGINT id PK
        BIGINT report_id FK
        INT version_number "UK with report_id"
        VARCHAR_4000 tasks_planned_next_week "nullable"
        VARCHAR_4000 notes "nullable"
        VARCHAR_1000 links "nullable"
        DATETIME_6 submitted_at "null while it is the open working copy"
        DATETIME_6 created_at
        DATETIME_6 updated_at
    }

    task_entries {
        BIGINT id PK
        BIGINT report_version_id FK
        INT display_order
        VARCHAR_255 task_name
        VARCHAR_20 priority "LOW | MEDIUM | HIGH"
        VARCHAR_20 status "NOT_STARTED | IN_PROGRESS | DONE | BLOCKED"
        INT planned_percent "0-100"
        INT actual_percent "0-100"
        DECIMAL_5_2 time_planned_hours
        DECIMAL_5_2 time_spent_hours
        VARCHAR_500 output_deliverable "nullable"
    }

    blockers {
        BIGINT id PK
        BIGINT report_version_id FK
        INT display_order
        VARCHAR_1000 description
        BIT_1 key_issue "at most one per version"
    }

    achievements {
        BIGINT id PK
        BIGINT report_version_id FK
        INT display_order
        VARCHAR_1000 description
        BIT_1 key_achievement "at most one per version"
    }

    hours_entries {
        BIGINT id PK
        BIGINT report_version_id FK
        VARCHAR_20 task_type "DEVELOPMENT | TESTING | MEETINGS | DOCUMENTATION | OTHER"
        DECIMAL_5_2 hours
    }

    review_comments {
        BIGINT id PK
        BIGINT report_version_id FK
        BIGINT reviewer_id FK
        VARCHAR_20 action "APPROVE | REQUEST_CHANGES"
        VARCHAR_2000 comment "required when action is REQUEST_CHANGES"
        DATETIME_6 created_at
    }
```

Column names and types above are the ones the migrations actually create — see
`db/migration/V1`, `V2` and `V3`. Exported images of this diagram, for the slide deck and the
submission folder, live in [`diagrams/`](diagrams/) — `er-diagram.png` for Google Slides,
which cannot import SVG, and `er-diagram.svg` for reading on screen.

## Why versioning is modeled this way

The assignment requires that when a report goes `Needs Correction → edited →
resubmitted`, the **previous content stays visible**, and a manager must be able to see
which version a given comment was made against.

- `REPORT` is the stable identity for "this user's report for this week" — it holds the
  `status` and the week. The current version is the highest `version_number`; there is no
  pointer column, which keeps `reports` and `report_versions` free of a circular FK.
- `submitted_at IS NULL` marks the one open working copy; a non-null value marks a frozen
  snapshot that **no code path ever writes again**.
- **Lazy fork** (as implemented): draft edits mutate the open version in place, submit
  freezes it, request-changes creates no version at all, and the owner's first edit *after*
  a freeze forks version `n+1` populated from that request. So a draft edited ten times is
  still one version, and a full correction cycle produces exactly two.
- `TASK_ENTRY`, `BLOCKER`, `ACHIEVEMENT`, `HOURS_ENTRY` all hang off a specific
  `REPORT_VERSION`, not the `REPORT` — so old versions keep their exact original rows
  even after a new version is created.
- `REVIEW_COMMENT` also hangs off a specific `REPORT_VERSION`, which directly answers
  "which version was this comment made against."

Why lazy rather than forking eagerly when the manager requests changes: it keeps the
manager's entire write surface to inserting a review comment and updating the report's
status, so "managers cannot rewrite report content" holds structurally rather than by
convention. It also removes any deep-copy step, since the new version is populated from the
incoming payload. See `docs/PHASE2_SPEC.md`.

## RBAC notes reflected in the schema

- A report's content (`REPORT_VERSION` and its children) is only ever written by its
  owner (`REPORT.user_id`). Managers write `REVIEW_COMMENT` rows and update
  `REPORT.status` — never the version content itself. This maps directly to the
  assignment's "managers can only edit status/comment fields" requirement.
- Every report-scoped query in the backend must filter by `user_id = currentUser.id`
  for `TEAM_MEMBER` callers; `MANAGER` callers may query across all users. This is
  enforced in the service layer, not just at the controller/role level.

## Role model (decided)

`Role` enum: `TEAM_MEMBER`, `MANAGER`. The assignment's "Required roles" list names
exactly these two ("Manager / Admin" is one role, not two) — see `docs/ARCHITECTURE.md`
for the full reasoning. `MANAGER` also covers the user-management page (invite/remove
team members, assign roles). No `ADMIN` role.
