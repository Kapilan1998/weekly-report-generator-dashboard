# Pages Inventory

The assignment requires at least **7** of the pages below, implemented and wired to
real backend data (Section 7). We're planning all of them since together they cover
every core requirement anyway.

| # | Page | Route (planned) | Role(s) | Status |
|---|------|------------------|---------|--------|
| 1 | Login / Register | `/login`, `/register` | anyone | **done** |
| 2 | Personal weekly report (create/edit) | `/reports/new`, `/reports/:id/edit` | Team Member | **done** |
| 3 | Report history (per user) | `/reports` | Team Member | **done** |
| 4 | Report detail / view (read-only) | `/reports/:id` | both | **done** — incl. version history |
| 5 | Team member profile (manager view) | `/team/:userId` | Manager | **done** — status stats + full history |
| 6 | Project/category management | `/projects` | Manager | **done** — create/rename/deactivate/delete |
| 7 | User management (admin) | `/admin/users` | Manager | **done** — add, assign role, disable, delete |
| 8 | Manager review page | `/review/:reportId` | Manager | **done** — approve / request changes |
| 9 | Team dashboard (filters + summary + charts) | `/team` | Manager | **done** — tiles, 4 charts, all five status filters incl. *not started*, week status, activity feed |
| 10 | Profile & settings *(extra)* | `/profile` | both | **done** |
| 11 | Compare sections *(bonus)* | `/team/sections` | Manager | **done** — one section across the team for a week |

That's 9 required-list pages + the team dashboard (which the assignment describes
separately in Section 4/6 but is effectively its own page) — comfortably over the
"at least 7" bar, plus the profile extra and the bonus section-comparison view.

**All of them are built and wired to real backend data.** What is left in `docs/PLAN.md`
is seed data (Phase 7), JUnit tests (Phase 8) and the deliverables wrap-up (Phase 10) —
no page work.

One gap worth knowing: there is no self-service profile editing. `/api/users` is
manager-only and deliberately administers access rather than identity, so "change my own
name or password" has no endpoint to call; `/profile` says so rather than showing a form
that can't save.

Update the Status column as pages get built (`not started` → `in progress` → `done`).
