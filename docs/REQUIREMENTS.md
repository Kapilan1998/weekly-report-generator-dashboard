# Requirements Summary

Source of truth: `Technical SE Assignment.pdf` (repo root). This file is a condensed,
searchable summary of that PDF for quick reference — if anything here seems ambiguous,
re-check the PDF.

**Title:** Weekly Report Generator & Team Dashboard

**Objective:** Full-stack app where team members submit structured weekly reports,
managers review/approve or request corrections, and managers get a consolidated
analytics dashboard across the team.

## 1. Auth & Roles
- Roles: **Team Member** (create/edit/submit own reports), **Manager/Admin** (view all
  reports, review/approve, analytics).
- Registration, login/logout, password protection, secure session handling, role
  assignment.

## 2. Personal Weekly Report Page
- Report structure is **fixed and identical for every user** — no per-user
  customization of fields/order.
- Fields per report:
  - Week / date range
  - Project/category tag
  - Tasks completed — task-level table: task name, priority, planned % vs actual %,
    status, time planned vs. time spent, output/deliverable
  - Tasks planned for next week
  - Blockers/challenges — one can be flagged as the key issue
  - Achievements/highlights — one can be flagged as the key achievement
  - Hours worked by task type (Development/Testing/Meetings/Documentation) — optional
  - Optional notes/links
- Actions: create as draft, edit while Draft or Needs Correction, submit for review,
  view own report history with status per week.

## 3. Report Review & Correction Workflow (core, required)
- Status flow: **Draft → Submitted → Needs Correction → Approved** (and
  Needs Correction → edited → Submitted again).
- Manager on a Submitted report: **Approve** or **Request Changes** (one general
  comment).
- Team member sees the manager's comment clearly, can edit and resubmit → back to
  Submitted.
- Team members see/edit only their own reports. Managers see everyone's reports but can
  only edit status/comment, never the report content itself.
- Bonus: history of past review comments (not just latest).
- **Report version history** (bonus but effectively required for full credit): each
  correction cycle keeps the previous version's content visible, not overwritten.
  Manager must be able to see each past version alongside the version under review, and
  which version a comment was made against. A simple list of past versions with
  timestamps is sufficient (no diff view needed).

## 4. Team Dashboard (Manager View)
- View all reports for a selected week.
- Filters: team member, project/category, date range, status (Draft/Submitted/Needs
  Correction/Approved/not started).
- Open a report to review + take action (Approve/Request Changes).
- Bonus: side-by-side view of one section (e.g. Blockers) across all team members for a
  selected week.

## 5. Projects / Categories
- CRUD for projects/categories (e.g. Client A, Internal Tooling, R&D, Marketing).
- Optional: assign team members to projects.

## 6. Dashboard & Visual Insights
- Summary metrics: total reports submitted this week, submission compliance rate
  (submitted/pending/late), count in Needs Correction, count of open blockers.
- Charts: tasks-completed trend over time, submission/approval status by team member,
  workload/task distribution by project, time spent by task type team-wide, recent
  activity feed (review actions).
- Any charting library allowed (Recharts, Chart.js, ECharts).

## 7. Additional Pages — implement at least 7
- Login / Register
- Personal weekly report (create/edit)
- Report history (per user, separate from create/edit)
- Report detail/view (read-only, used by both roles)
- Team member profile (manager view — full history + stats)
- Project/category management (real page with CRUD, not a modal)
- User management (admin — invite/remove, assign roles)
- Manager review page (Approve/Request Changes + comment)
- (free to add more, e.g. account settings)
- **Two or three basic screens is an automatic "incomplete."**

## 8. AI Chat Assistant — optional, bonus
- Conversational Q&A for managers about team activity.
- AI-generated team summary (completed work, recurring blockers, workload imbalance).
- Simple chat widget UI.
- Any LLM provider/approach; document prompt design and data-privacy considerations if
  built.

## Technical Requirements
- **Frontend:** React/Next.js/Angular/Vue preferred. Responsive, component-based, clean
  reusable components, well-structured folders, clear separation between personal
  report page / report history / team dashboard, basic client-side validation.
- **Backend:** Spring Boot/.NET/Node/Python preferred. REST API, request validation,
  role-based access control (a team member must never reach another team member's data
  or a manager-only endpoint), clean service/controller structure, pagination and/or
  filtering on any list-of-reports endpoint.
- **Database:** any (Postgres/MySQL/MongoDB). Schema must clearly represent users,
  roles, projects, reports, and review/status history (at minimum current status +
  latest reviewer comment).

## Scope & Difficulty Expectations
- ≥7 of the Section 7 pages, wired to real backend data (not mocked).
- A working end-to-end cycle: submit → manager requests changes → member edits/resubmits
  → manager approves.
- Seeded dataset: 3–5 team members, several weeks of reports in different statuses.
- At least one automated test covering RBAC (bonus, strongly recommended).
- A deployed, publicly accessible instance (bonus; local-only accepted).

## Deliverables
1. **Presentation** (Google Slides): architecture, DB design, key frontend components,
   API/RBAC design, review-workflow implementation, AI chat approach (if built),
   challenges, future improvements.
2. **GitHub repo**: frontend code, backend code, and a root **README** covering
   1) installing dependencies, 2) running frontend, 3) running backend, 4) running
   database.
3. **ER diagram** (image) covering users/roles/projects/reports/review-status history.
4. **Video demo**: walkthrough as both roles, full review/correction cycle, 2–3
   different team members' reports (to prove real multi-user data), key features,
   frontend flow, AI chat demo if built. Camera on. No raw DB queries on camera.

## Evaluation Criteria
System design, code quality, UI structure/completeness, component reusability, API
design incl. RBAC, database design, correctness/completeness of the review workflow,
documentation clarity, presentation clarity, **genuine understanding of your own
codebase** (there is a live-coding round where you explain and extend it), AI chat
bonus.

## Submission mechanics
Single Google Drive folder (slides + ER diagram + video, "Anyone with the link").
Submission email body: GitHub repo link + Drive folder link. Incomplete/inaccessible
links are grounds for rejection outright — double-check before sending.
