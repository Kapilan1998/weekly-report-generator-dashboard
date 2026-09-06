# Data Model

Status: **planned, not yet implemented**. This is the working draft for the ER diagram
deliverable (Section 3 of the assignment) — export an actual diagram image from this
once it stabilizes (e.g. via dbdiagram.io, drawio, or a Mermaid render) and save it
under `docs/diagrams/`.

## Entity-relationship overview

```mermaid
erDiagram
    USER ||--o{ REPORT : owns
    USER ||--o{ PROJECT_MEMBER : "assigned via"
    PROJECT ||--o{ PROJECT_MEMBER : "assigned via"
    PROJECT ||--o{ REPORT : "tagged on"
    REPORT ||--|{ REPORT_VERSION : "has versions"
    REPORT_VERSION ||--o{ TASK_ENTRY : contains
    REPORT_VERSION ||--o{ BLOCKER : contains
    REPORT_VERSION ||--o{ ACHIEVEMENT : contains
    REPORT_VERSION ||--o{ HOURS_ENTRY : contains
    REPORT_VERSION ||--o{ REVIEW_COMMENT : "reviewed by"
    USER ||--o{ REVIEW_COMMENT : authors

    USER {
        bigint id PK
        varchar name
        varchar email UK
        varchar password_hash
        enum role "TEAM_MEMBER | MANAGER"
        datetime created_at
    }
    PROJECT {
        bigint id PK
        varchar name
        varchar description
        datetime created_at
    }
    PROJECT_MEMBER {
        bigint id PK
        bigint user_id FK
        bigint project_id FK
    }
    REPORT {
        bigint id PK
        bigint user_id FK
        bigint project_id FK
        date week_start
        date week_end
        enum status "DRAFT | SUBMITTED | NEEDS_CORRECTION | APPROVED"
        bigint current_version_id FK
        datetime created_at
        datetime updated_at
    }
    REPORT_VERSION {
        bigint id PK
        bigint report_id FK
        int version_number
        text tasks_planned_next_week
        text notes
        varchar links
        datetime submitted_at
    }
    TASK_ENTRY {
        bigint id PK
        bigint report_version_id FK
        varchar task_name
        enum priority "LOW | MEDIUM | HIGH"
        int planned_pct
        int actual_pct
        enum status "NOT_STARTED | IN_PROGRESS | DONE | BLOCKED"
        decimal time_planned_hours
        decimal time_spent_hours
        varchar output_deliverable
    }
    BLOCKER {
        bigint id PK
        bigint report_version_id FK
        text description
        boolean is_key_issue
    }
    ACHIEVEMENT {
        bigint id PK
        bigint report_version_id FK
        text description
        boolean is_key_achievement
    }
    HOURS_ENTRY {
        bigint id PK
        bigint report_version_id FK
        enum task_type "DEVELOPMENT | TESTING | MEETINGS | DOCUMENTATION | OTHER"
        decimal hours
    }
    REVIEW_COMMENT {
        bigint id PK
        bigint report_version_id FK
        bigint reviewer_id FK
        enum action "APPROVED | REQUEST_CHANGES"
        text comment
        datetime created_at
    }
```

## Why versioning is modeled this way

The assignment requires that when a report goes `Needs Correction → edited →
resubmitted`, the **previous content stays visible**, and a manager must be able to see
which version a given comment was made against.

- `REPORT` is the stable identity for "this user's report for this week" — it holds the
  current `status` and a pointer to the `current_version_id`.
- Every submit (including every resubmit after correction) creates a new
  `REPORT_VERSION` row — a full snapshot of that submission's content (tasks, blockers,
  achievements, hours, planned-next-week, notes). Nothing is overwritten in place.
- `TASK_ENTRY`, `BLOCKER`, `ACHIEVEMENT`, `HOURS_ENTRY` all hang off a specific
  `REPORT_VERSION`, not the `REPORT` — so old versions keep their exact original rows
  even after a new version is created.
- `REVIEW_COMMENT` also hangs off a specific `REPORT_VERSION`, which directly answers
  "which version was this comment made against."
- Draft edits (before first submit) can update the single not-yet-submitted version in
  place, or always create version 1 on first save — a small implementation choice to
  make during Phase 2 (see `docs/PLAN.md`); the simplest option is: **draft = version 0,
  mutated in place; every actual "Submit" click snapshots/finalizes a version and starts
  the next one on the next edit**.

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
