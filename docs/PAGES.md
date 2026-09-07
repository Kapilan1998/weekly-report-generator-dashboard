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
| 5 | Team member profile (manager view) | `/team/:userId` | Manager | not started |
| 6 | Project/category management | `/projects` | Manager | not started |
| 7 | User management (admin) | `/admin/users` | Manager | not started |
| 8 | Manager review page | `/review/:reportId` | Manager | not started |
| 9 | Team dashboard (filters + summary + charts) | `/team` | Manager | list + status filter done (Phase 4); summary tiles and charts need Phase 3's endpoints |
| 10 | Profile & settings *(extra)* | `/profile` | both | **done** |

That's 9 required-list pages + the team dashboard (which the assignment describes
separately in Section 4/6 but is effectively its own page) — comfortably over the
"at least 7" bar, plus one optional extra.

Update the Status column as pages get built (`not started` → `in progress` → `done`).
