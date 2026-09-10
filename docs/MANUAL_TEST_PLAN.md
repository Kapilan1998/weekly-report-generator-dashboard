# Manual test plan — Weekly Report Generator & Team Dashboard

A click-by-click walkthrough of the whole application, in the order a real user would meet
it: sign up, file a report, get it sent back, correct it, get it approved, then everything a
manager can do.

- **Branch this was written against:** `bug/bug-fixing`
- **Last updated:** 2026-09-09
- **Status:** not yet run

Every test says where to go, what to click, and what you should see. Work top to bottom —
later tests depend on data created by earlier ones.

---

## How to use this document

1. Work through the tests in order. Tick the box in the **Result** column of each section's
   table as you go: `[x]` pass, `[F]` fail, `[-]` skipped.
2. When something fails, **don't stop** — note it and carry on unless the failure blocks the
   next test. Record it in [Issues found](#issues-found) using the template there.
3. Hand the issue back to Claude. It gets fixed, and **this file gets updated in the same
   change** — either the steps are corrected (if the document was wrong) or a regression note
   is added under the test (if the code was wrong).
4. `docs/PLAN.md` records *what* is built and why. This file records *how to check it works*.
   They are separate on purpose.

**The document can be wrong too.** If a step names a button that isn't there, or an expected
result that was never the intent, that is a bug in this file — report it the same way.

---

## Before you start

### 1. Start the two servers

Two terminals, from the repo root:

```powershell
# Terminal 1 — backend on http://localhost:8080
cd backend\weekly-report-backend
.\mvnw spring-boot:run
```

```powershell
# Terminal 2 — frontend on http://localhost:5173
cd frontend
npm run dev
```

Wait for `Started WeeklyReportBackendApplication` before using the app.

> **Use port 5173.** The backend's CORS rule allows that origin only. If Vite says
> "Port 5173 is in use, trying 5174", stop the other process and restart — on 5174 every
> API call returns 403 and the app looks broken for the wrong reason.

### 2. Check both are up

Open `http://localhost:5173` — you should land on the sign-in screen.

### 3. Accounts you will need

You need **one team member** and **one manager**. Test A2 creates the team member; a manager
cannot be self-registered, so it has to already exist.

> ## ⚠️ On this machine, sign in with these
>
> | Email | Role | Password |
> |---|---|---|
> | **`bob@example.com`** | **Manager** | `Demo@1234` |
> | `alice@example.com` | Team member | `Demo@1234` |
> | `dana.tester@example.com` | Team member | `Demo@1234` |
>
> **`maya.sharma@example.com`, `sofia.rossi@example.com` and the other four demo addresses
> do not exist in this database and will always return 401.** They are listed further down
> only for the case where the seeder actually ran. Details in
> [This machine's accounts](#this-machines-accounts-as-of-2026-09-09).

#### First, find out which accounts your database actually has

Run this in MySQL Workbench, or any client:

```sql
SELECT id, name, email, role, enabled,
       (SELECT COUNT(*) FROM reports r WHERE r.user_id = u.id) AS reports
FROM users u ORDER BY role DESC, id;
```

> **Do this before you try any credentials.** The demo accounts below exist **only if the
> database was empty the first time the backend started** — `DemoDataSeeder` deliberately
> skips when the `users` table already has rows, so it never overwrites real data. If you
> developed against this database, you almost certainly have your **own** accounts instead,
> and every demo password below will return `401 Invalid email or password`. That is the
> seeder being careful, not a broken login.

#### If the query returned the six demo accounts

**Not this machine — see the box above.** These exist only where the seeder ran against an
empty database. Password for all of them is `Demo@1234`:

| Email | Role |
|---|---|
| `maya.sharma@example.com` | Manager |
| `tom.becker@example.com` | Manager |
| `priya.nair@example.com` | Team member |
| `daniel.osei@example.com` | Team member |
| `sofia.rossi@example.com` | Team member |
| `liam.chen@example.com` | Team member |

#### If it returned different accounts

Your database was not empty when the backend first started, so the seeder skipped and you
have your own accounts instead. Use a **manager** from your own list with the password you
set for it. You only need one — every further account can be created from inside the app,
with its role, from **User management**.

If you don't know any of your passwords, reset **one** in place. This keeps every report you
already have; only `password_hash` changes:

```sql
-- Sets the password of ONE account to Demo@1234. Replace the email with yours.
UPDATE users
SET password_hash = '$2a$10$EiLx5NUbtk8p.kViCyVvQuYmbNA2VHvm.1BxOSYD..PHn2uiXqMUe'
WHERE email = 'bob@example.com';
```

> That hash is bcrypt for `Demo@1234`, generated with this project's own
> `BCryptPasswordEncoder` and verified against it — not copied from anywhere. bcrypt is
> salted, so a hash you generate yourself will look different and work just as well.
> Change the password from **Profile & settings** once you are in; test K6 does exactly that.

Prefer a clean slate instead? ⚠️ **This deletes every report you have:**

```sql
DROP DATABASE weekly_report_dashboard;
```

Restart the backend afterwards — Flyway rebuilds the schema and the seeder loads all six demo
accounts plus 21 reports across several weeks in mixed statuses. That is the data this plan
was written against, and it is the only practical way to get a real spread of statuses for the
dashboard and chart tests in Part F.

#### This machine's accounts, as of 2026-09-09

Specific to the local development database — **delete this subsection before submitting**, it
is not part of the deliverable.

The password below was set on these three rows only, and each was verified through
`POST /api/auth/login` (HTTP 200). No reports, roles or reviews were changed.

**Password: `Demo@1234`**

| Email | Role | Reports | Use for |
|---|---|---|---|
| `bob@example.com` | **Manager** | 0 | Parts C, E, F, G, H, I, J, M |
| `alice@example.com` | Team member | 16 | The member in Parts B, D, K |
| `dana.tester@example.com` | Team member | 14 | The *peer* whose report must stay hidden, test L2 |

Two notes on using these rather than a freshly registered account:

- **Part B assumes an empty history.** `alice@example.com` already has 16 reports, so B1's
  *No reports yet* and B6's "one row" will not match. Either run Part A first and use the
  account **A2 creates** for Parts B–D, or read those two expectations as "your new report
  appears in the list".
- **`bob@example.com` is your only manager.** Test **J8** (the last-manager guard) needs a
  second one — create it from **User management** first, or skip J8.

### 4. Two accounts, two browser windows

Several tests switch between a member and a manager. Easiest way is one **normal window** for
the member and one **incognito window** for the manager — the JWT is held in `localStorage`
per browser profile, so signing in as one does not disturb the other.

### 5. Note for reading results

- The week always runs **Monday to Sunday**. Any week you pick snaps to its Monday.
- The report list and dashboard show the week as a **date range**, never a week number.

---

## Part A — Sign up, sign in, sessions

| # | Test | Result |
|---|---|---|
| A1 | Sign-in screen loads | `[ ]` |
| A2 | Create a new account | `[ ]` |
| A3 | Registration rejects a weak password | `[ ]` |
| A4 | Registration rejects a duplicate email | `[ ]` |
| A5 | Sign in with a wrong password | `[ ]` |
| A6 | Session survives a page refresh | `[ ]` |
| A7 | Sign out | `[ ]` |
| A8 | Protected page redirects when signed out | `[ ]` |
| A9 | Password show/hide toggle | `[ ]` |

### A1 — Sign-in screen loads

1. Go to `http://localhost:5173`.

**Expect:** You are redirected to `/login`. Heading **Welcome back**, an **Email** field, a
**Password** field, a **Sign in** button, and *No account yet? Create one* underneath. The
left panel is green; the right side is navy blue.

### A2 — Create a new account

1. On `/login`, click **Create one**.
2. The URL becomes `/register` and the heading is **Create your account**.
3. Fill in:
   - **Full name:** `Test Member`
   - **Email:** `test.member@example.com`
   - **Password:** `Test@1234`
4. Click **Create account**.

**Expect:** You are signed in immediately and land on `/reports` (**My reports**), which says
*No reports yet*. Top-right shows `Test Member` with **Team member** underneath.

**Expect:** The left navigation shows only **My reports** and **Profile & settings** — no
manager entries.

> A self-registered account is always a team member. There is deliberately no role field on
> this form; the public endpoint would otherwise let anyone create a manager.

### A3 — Registration rejects a weak password

1. Sign out if you are signed in (see A7). Go to `/register`.
2. Enter a valid name and an unused email, then password `abc`.
3. Click **Create account**.

**Expect:** Inline red text under **Password**: *Password must be at least 8 characters*. No
account is created and you stay on `/register`.

4. Change the password to `abcdefgh` (no uppercase, digit or symbol) and submit again.

**Expect:** *Add an uppercase letter, a lowercase letter, a number and a special character*.

5. Put `Test123` in **Full name** and submit.

**Expect:** *Name must contain only letters and spaces*.

### A4 — Registration rejects a duplicate email

1. On `/register`, enter name `Another Person`, email `test.member@example.com` (the one from
   A2), password `Test@1234`.
2. Click **Create account**.

**Expect:** A red banner at the top of the form saying an account with that email already
exists. You stay on `/register`.

### A5 — Sign in with a wrong password

1. Go to `/login`. Enter `test.member@example.com` and password `WrongPass1!`.
2. Click **Sign in**.

**Expect:** A red banner: *Invalid email or password*. You stay on `/login`.

3. Try a non-existent email with any password.

**Expect:** The **same** message, not "no such user".

> Identical wording is deliberate — a different message would confirm which addresses have
> accounts.

### A6 — Session survives a page refresh

1. Sign in as `test.member@example.com` / `Test@1234`.
2. Once on `/reports`, press <kbd>F5</kbd>.

**Expect:** You stay on **My reports**. No flash of the login screen, no loading spinner
before the page appears.

### A7 — Sign out

1. Click your name in the **top-right corner**.
2. In the menu, click **Sign out**.

**Expect:** You land on `/login`. Pressing the browser **Back** button does not get you back
into the app — you stay on the sign-in screen.

### A8 — Protected page redirects when signed out

1. While signed out, type `http://localhost:5173/reports` in the address bar.

**Expect:** You are sent to `/login`.
2. Sign in.

**Expect:** You land on `/reports` — the page you originally asked for, not a generic home.

### A9 — Password show/hide toggle

1. Sign out and go to `/login`.
2. Type something into **Password**.

**Expect:** The characters are masked as dots, and an **eye icon** sits inside the right-hand
end of the field.

3. Click the eye.

**Expect:** The password becomes readable and the icon changes to a **struck-through eye**.
The form is **not** submitted by the click.

4. Click it again.

**Expect:** The characters are masked again.

5. Reach the eye with the keyboard: focus the password field and press <kbd>Tab</kbd> once,
   then <kbd>Space</kbd> or <kbd>Enter</kbd>.

**Expect:** The toggle takes focus with a visible outline and flips the visibility. Pressing
<kbd>Enter</kbd> on it must not submit the form.

6. Go to `/register` and repeat steps 2–4 on its **Password** field.

**Expect:** The same behaviour. The hint *8+ characters, with upper and lower case, a number
and a symbol.* stays visible beneath the field, and a long password does not run underneath
the icon.

7. Reveal the password, then navigate from `/login` to `/register` (or reload the page).

**Expect:** The next field starts **masked** — the choice is not remembered, so a revealed
password is never left on screen after you move on.

> The toggle is on the sign-in and sign-up forms only. The three password fields on
> **Profile & settings** do not have it yet — see K5/K6.

---

## Part B — Filing a report (team member)

Sign in as `test.member@example.com`.

| # | Test | Result |
|---|---|---|
| B1 | Empty state and New report button | `[ ]` |
| B2 | The week picker | `[ ]` |
| B3 | Task table displays fully | `[ ]` |
| B4 | Field validation | `[ ]` |
| B4b | Mouse wheel does not change a number field | `[ ]` |
| B5 | Save a draft | `[ ]` |
| B6 | Draft appears in My reports | `[ ]` |
| B7 | Submitting an incomplete report is blocked | `[ ]` |
| B8 | Fill in the whole report and submit | `[ ]` |
| B9 | A submitted report cannot be edited | `[ ]` |
| B10 | Two reports for the same week are refused | `[ ]` |
| B11 | Delete a draft | `[ ]` |
| B12 | Only drafts can be deleted | `[ ]` |

### B1 — Empty state and New report button

1. You are on **My reports** (`/reports`).

**Expect:** *No reports yet*, and a **+ New report** button top-right.

2. Click **+ New report**.

**Expect:** URL `/reports/new`, heading **New weekly report**.

### B2 — The week picker

1. In the **Week** field, click the control showing a date range (e.g. `07 – 13 Sep 2026`).

**Expect:** A navy calendar panel opens below it — month name with `‹` `›` arrows, weekday
headers **Mo Tu We Th Fr Sa Su**, six rows of dates, and **This week** at the bottom.

2. Hover over any row of dates.

**Expect:** The **whole week row** highlights in violet, not a single day.

3. Move the mouse to a different row.

**Expect:** The highlight follows the row. Today's date keeps a violet ring at all times.

4. Click any day in a row.

**Expect:** The panel closes. The field shows that week's Monday–Sunday range, and the text
underneath reads *Covers <date> – <date>.*

5. Reopen the picker and click `‹` twice, then `›` twice.

**Expect:** The month name changes each time and returns to where it started. The panel does
not change height.

6. Reopen and press <kbd>Esc</kbd>.

**Expect:** The panel closes and nothing is selected.

> This is a **week** picker, not a date picker — you cannot select a single day, because a
> report always covers a whole week.

### B3 — Task table displays fully

1. Scroll to **Tasks completed**. One empty row is already there.
2. Look at the **Priority** column.

**Expect:** It reads **Medium** in full — not a clipped `M`.

3. Look at the **Status** column.

**Expect:** It reads **Not started** in full — not an empty box with only a chevron.

4. Click the **Priority** dropdown.

**Expect:** Three options: **Low**, **Medium**, **High**. Pick **High** — the closed field
then shows *High* in full.

5. Click the **Status** dropdown.

**Expect:** Four options: **Not started**, **In progress**, **Done**, **Blocked**. Pick
**In progress** — the closed field shows it in full.

6. Scroll the task table sideways.

**Expect:** The table scrolls **inside its own box**. The page itself does not shift
sideways, and the left navigation stays put.

### B4 — Field validation

1. Leave **Task name** empty and put `150` in **Planned %**.
2. Click **Save draft** at the bottom.

**Expect:** A banner *Fix the highlighted fields and try again.* Under **Task name**:
*Required*. Under **Planned %**: *0–100*.

3. Clear the project select back to **Choose a project…** if you had set one, and save again.

**Expect:** *Choose a project* under **Project / category**.

4. In **Time spent (h)**, enter `1000`.

**Expect:** *0–999.99*.

### B4b — Mouse wheel does not change a number field

1. In the task table, type `50` into **Planned %**.
2. Leave the cursor over that field and scroll the mouse wheel up, then down.

**Expect:** The value stays `50`. The page scrolls normally.

3. Repeat on **Actual %**, **Time planned (h)**, **Time spent (h)**, and on the
   **Hours by task type** fields lower down the form.

**Expect:** The same — no field changes its value from scrolling.

4. Click into **Planned %** and press <kbd>↑</kbd> and <kbd>↓</kbd>.

**Expect:** The value **does** step up and down. Arrow keys are a deliberate keystroke and
are meant to work; only the wheel is suppressed.

> A focused number input treats the wheel as increment/decrement, so scrolling the page with
> the pointer over one used to silently rewrite the value — and in a row of four numeric
> columns, the number that changed was not the one you were looking at. Every numeric field
> in the app goes through one component, so the fix covers all of them.

### B5 — Save a draft

1. Fill in the minimum:
   - **Week:** this week
   - **Project / category:** pick any
   - **Task name:** `Write the test plan`
   - **Priority:** `High`
   - **Planned %:** `100`, **Actual %:** `80`
   - **Status:** `In progress`
   - **Time planned (h):** `6`, **Time spent (h):** `5.5`
   - **Output / deliverable:** `MANUAL_TEST_PLAN.md`
2. Click **Save draft**.

**Expect:** You are taken to the report's detail page (`/reports/<id>`). The heading is the
week's date range, and there is a grey **Draft** badge.

### B6 — Draft appears in My reports

1. Click **My reports** in the left navigation.

**Expect:** One row: the week range, the project name, a **Draft** badge, and **Last
submitted** showing `—` (it has never been submitted).

### B7 — Submitting an incomplete report is blocked

1. Open the draft from **My reports**.
2. Click **Edit report**.
3. Clear **Tasks planned for next week** if it has anything in it, and click
   **Save & submit for review**.

**Expect:** A banner: *Add at least one task and fill in next week's plan before submitting.*
Inline under **Tasks planned for next week**: *Fill this in before submitting*. The report
stays a **Draft**.

> Note the difference from B4: a **draft** may be incomplete, but **submitting** requires at
> least one task and next week's plan. Two different rule sets on the same form.

### B8 — Fill in the whole report and submit

1. Still in the editor, fill in every section:
   - **Tasks planned for next week:** `Run the manual test plan end to end`
   - **Blockers / challenges:** click **+ Add blocker**, enter
     `Waiting on review feedback`, and select **Key issue for the week** beneath it
   - **Achievements / highlights:** click **+ Add achievement**, enter
     `Test plan drafted`, and select **Key achievement for the week**
   - **Hours by task type:** `Development 20`, `Testing 10`, `Meetings 4`,
     `Documentation 6`
   - **Notes (optional):** `First submission`
2. Click **Save & submit for review**.

**Expect:** The detail page shows a blue **Submitted** badge, and **Last submitted** now
carries a date and time. The **Edit** button is gone.

3. Add a **second** blocker and select its **Key issue for the week** control.

**Expect:** The flag **moves** to the second blocker and clears from the first — only one can
ever be flagged.

> The flag is a radio group, not a checkbox, so the "only one key issue" rule cannot be broken
> from the UI at all. The backend still validates it as a backstop, but you should not be able
> to trigger that error by clicking.

### B9 — A submitted report cannot be edited

1. On the detail page of the submitted report, look for an edit control.

**Expect:** There is none.

2. Type `/reports/<id>/edit` into the address bar for that report.

**Expect:** An amber notice — *This report can't be edited while it is submitted* — with a
**View it instead** link.

### B10 — Two reports for the same week are refused

1. Go to **My reports** → **+ New report**.
2. Pick the **same week** you just submitted, choose any project, add one task, and click
   **Save draft**.

**Expect:** An inline error on the **Week** field saying you already have a report for that
week, plus a link **Open your existing report for this week →**. Clicking it opens the
existing report.

### B11 — Delete a draft

1. Create two or three drafts for **different** weeks (repeat B5), so there is something to
   select. Go to **My reports**.

**Expect:** A checkbox at the start of each **Draft** row, and one in the table header.

2. Tick one draft.

**Expect:** A bar appears at the top of the list: *1 draft selected*, with **Delete selected**
and **Clear**. The ticked row is tinted.

3. Click the row's **week link**, then come back. Now tick a box again and click the row's
   empty space.

**Expect:** Ticking a box does **not** open the report. Clicking anywhere else on the row
still does.

4. Click the **header checkbox**.

**Expect:** Every draft on the page is ticked, and the bar shows the full count. Click it
again to clear.

5. With two drafts ticked, click **Delete selected**.

**Expect:** A small popup opens over a dimmed page: a warning triangle, the heading
*Delete 2 drafts?*, the sentence *These 2 drafts and everything in them will be removed. This
cannot be undone.*, and two buttons — **No** and **Yes, delete**.

6. Click **No**.

**Expect:** The popup closes and **nothing is deleted**. The selection is still ticked, so you
can change your mind without starting over.

7. Reopen it and press <kbd>Esc</kbd>. Reopen again and click the dimmed area outside the
   popup.

**Expect:** Both close it without deleting.

8. Reopen it and press <kbd>Tab</kbd> a few times.

**Expect:** Focus starts on **No** and cycles **only** between the two buttons — it never
reaches the page behind. Clicking a row behind the dimmed area does nothing, and the page
behind does not scroll.

**Expect:** The popup is **centred in the viewport**, on a dimmed background. If it appears
in a corner, or with the page behind it undimmed, that is a bug — report it.

> Focus starting on **No** is deliberate, and the opposite of what feels natural: the action
> cannot be undone, so a stray <kbd>Enter</kbd> must not carry it out. Confirming is one
> <kbd>Tab</kbd> away.

9. Reopen it and click **Yes, delete**.

**Expect:** The button shows a spinner and reads *Deleting…*, then the popup closes and a
green *Deleted 2 drafts.* appears. The rows are gone, the list refreshes, and the pagination
total drops by two.

10. Reload the page.

**Expect:** They are still gone — the deletion reached the database, it wasn't just removed
from the screen.

11. Tick a draft, click **Delete selected**, then click **Yes, delete**. Once it finishes,
    look at the screen carefully.

**Expect:** The popup is **gone**. It must never be left open showing *Delete 0 drafts?* —
the selection is cleared by a successful delete, so a popup still on screen would be asking
about nothing.

12. Tick a draft, click **Delete selected** to open the popup, then click **Clear** in the
    selection bar behind it — if you can reach it.

**Expect:** You cannot: the popup traps focus and the backdrop swallows the click. The popup
only ever appears in response to **Delete selected**, and only while something is selected.

### B12 — Only drafts can be deleted

This is the important half. A draft is private working notes; anything submitted belongs to
the review record.

1. On **My reports**, look at a row with a **Submitted**, **Needs correction** or **Approved**
   badge.

**Expect:** **No checkbox** — just an empty outline. Hovering it reads *Only a draft can be
deleted*. It cannot be selected, so it can never be part of a bulk delete.

2. Tick the header checkbox on a page holding a mix of statuses.

**Expect:** Only the **Draft** rows get ticked. The count in the bar equals the number of
drafts, not the number of rows.

3. Try the API directly, using the id of a submitted report of your own:

```powershell
# Replace <id> and <token>; the token is in localStorage under "wrg.auth".
curl.exe -X DELETE http://localhost:8080/api/reports/<id> -H "Authorization: Bearer <token>"
```

**Expect:** **409 Conflict** — *Only a draft can be deleted. A report that has been submitted
is part of the review record and stays.*

4. Try the same against a report belonging to **another** member (e.g. one of
   `dana.tester@example.com`'s).

**Expect:** **404**, not 403 — the same answer a missing id gives, so ids cannot be probed
through this endpoint.

> **Why submitted reports stay.** Once a report is submitted a manager may have approved it or
> sent it back with a comment, and every frozen version and review comment hangs off it.
> Deleting it would let an author erase a decision made about their own work, and would
> silently move a past week's compliance figures on the dashboard. It is the same line the app
> draws for accounts: a user who has filed reports can only be **disabled**, never deleted
> (test J7). If report deletion were allowed after submission, that rule would be pointless.

---

## Part C — Manager review: request changes

Switch to your **manager** account (incognito window is easiest).

| # | Test | Result |
|---|---|---|
| C1 | Manager navigation appears | `[ ]` |
| C2 | The submitted report is visible team-wide | `[ ]` |
| C3 | Approve requires nothing; request changes requires a comment | `[ ]` |
| C4 | Request changes | `[ ]` |
| C5 | A manager cannot review their own report | `[ ]` |

### C1 — Manager navigation appears

1. Sign in as your manager.

**Expect:** The left navigation now shows **My reports**, **Team dashboard**,
**Compare sections**, **Projects**, **User management**, **Profile & settings**. Top-right
shows the name with **Manager** underneath.

### C2 — The submitted report is visible team-wide

1. Click **Team dashboard**.
2. Set the week picker to the week `Test Member` submitted.
3. Scroll to the report list at the bottom.

**Expect:** A row for **Test Member** with a **Submitted** badge and a **Review** button.

### C3 — Approve requires nothing; request changes requires a comment

1. Click **Review** on that row. URL becomes `/review/<id>`.

**Expect:** The full report content, then a **Your decision** panel with two options —
**Approve** ("Accept the report as filed") and **Request changes** ("Send it back for
correction").

2. Select **Request changes**, leave the comment box empty, and click the red
   **Request changes** button.

**Expect:** A validation error — the comment is required. Nothing is saved.

3. Select **Approve**.

**Expect:** The comment box label changes to **Note (optional)** and the hint says it is
optional.

### C4 — Request changes

1. Select **Request changes**.
2. Type: `The hours breakdown adds up to 40h but the tasks total 5.5h — please reconcile.`
3. Click **Request changes**.

**Expect:** A confirmation, and the report's badge becomes amber **Needs correction**.

4. Go back to **Team dashboard** for that week.

**Expect:** The **Needs correction** tile count has gone up by one, and the row for
`Test Member` now shows **Needs correction** with no **Review** button.

### C5 — A manager cannot review their own report

1. As the manager, file and submit a report of your own (repeat B5 and B8 briefly).
2. Open it and try to reach `/review/<its id>`.

**Expect:** An info panel — **No decision to make here** — *This is your own report — a
manager cannot review their own submission.* No decision controls.

---

## Part D — Correction and resubmission (team member)

Back in the member window as `test.member@example.com`.

| # | Test | Result |
|---|---|---|
| D1 | The correction request is visible with its comment | `[ ]` |
| D2 | Edit and resubmit | `[ ]` |
| D3 | Version history shows both versions | `[ ]` |
| D4 | The week cannot be changed | `[ ]` |
| D5 | The project cannot be changed after submission | `[ ]` |

### D1 — The correction request is visible with its comment

1. Go to **My reports**.

**Expect:** The row shows an amber **Needs correction** badge.

2. Open it.

**Expect:** An amber banner carrying the **manager's exact comment** from C4, and an
**Edit & resubmit** button.

### D2 — Edit and resubmit

1. Click **Edit & resubmit**.
2. Change **Time spent (h)** to `40`.
3. Click **Save & submit for review**.

**Expect:** The badge returns to blue **Submitted**, and **Last submitted** shows a newer
timestamp than before.

### D3 — Version history shows both versions

1. On the detail page, find the version history section.

**Expect:** **Two** versions listed. Version 1 is the original submission; version 2 is the
correction. Opening version 1 shows `5.5` in **Time spent**; version 2 shows `40`.

> Only **submitted** versions appear. A draft you never submitted is not a version.

### D4 — The week cannot be changed

1. Click into the editor of any existing report.

**Expect:** **Week** is shown as read-only text with the note *A report's week can't be
changed.* — not a picker.

### D5 — The project cannot be changed after submission

1. In the editor of the report you submitted in D2, look at **Project / category**.

**Expect:** The select is disabled. A report's project freezes once it has been submitted, so
an already-reviewed version's context cannot be rewritten underneath it.

---

## Part E — Manager approval

Manager window.

| # | Test | Result |
|---|---|---|
| E1 | Approve the resubmitted report | `[ ]` |
| E2 | An approved report is final | `[ ]` |
| E3 | The approval note reaches the author | `[ ]` |

### E1 — Approve the resubmitted report

1. **Team dashboard** → the member's week → **Review**.

**Expect:** The decision panel says *Reviewing version 2*, and the previous decision
(request changes, with its comment) is shown above.

2. Select **Approve**, type `Thanks, that reconciles.` in the note, and click
   **Approve report**.

**Expect:** The badge becomes green **Approved**.

### E2 — An approved report is final

1. Try to reach `/review/<that id>` again.

**Expect:** **No decision to make here** — *This report is already approved.*

2. In the **member** window, open the report.

**Expect:** No edit button. Trying `/reports/<id>/edit` gives the amber
*can't be edited while it is approved* notice.

### E3 — The approval note reaches the author

1. In the member window, on the report detail page.

**Expect:** A green banner with the manager's approval note `Thanks, that reconciles.`

---

## Part F — Team dashboard

Manager window → **Team dashboard**.

| # | Test | Result |
|---|---|---|
| F1 | Summary tiles | `[ ]` |
| F2 | Week picker and the compliance bar | `[ ]` |
| F3 | The four charts | `[ ]` |
| F4 | Filters | `[ ]` |
| F5 | Filters are shareable through the URL | `[ ]` |
| F6 | Not started filter | `[ ]` |
| F7 | Activity feed | `[ ]` |
| F8 | The Action column says what you can do | `[ ]` |

### F1 — Summary tiles

**Expect:** Four tiles across the top — **Submitted** (as `n / total`), **Still drafting**,
**Needs correction**, **Open blockers**.

1. Click the **Needs correction** tile.

**Expect:** It behaves as a link: the report list below filters to needs-correction reports,
and the URL gains a filter parameter.

### F2 — Week picker and the compliance bar

1. Use `‹` and `›` either side of the week field to step back and forward a week.

**Expect:** Every tile, the compliance bar and the report list all update. The date range
under the picker changes with it.

2. Look at **Submission compliance**.

**Expect:** A percentage, and a segmented bar with a legend — **Submitted**, **Draft**,
**Not started** — whose counts add up to the team size.

### F3 — The four charts

**Expect:** Four charts, all drawn with real data:

| Chart | What it shows |
|---|---|
| **Tasks completed per week** | One column per week over the selected window |
| **Reports by status** | One stacked bar per team member |
| **Workload by project** | One bar per project |
| **Hours by task type** | One bar per task type |

1. Change the **Last N weeks** select next to the week picker.

**Expect:** The **Tasks completed per week** chart changes its number of columns.

### F4 — Filters

1. Scroll to the filter panel above the report list.
2. Set **Team member** to `Test Member`.

**Expect:** The list shows only that member's reports.

3. Set **Project** to the project you used.

**Expect:** The list narrows further.

4. Click the **Approved** status chip.

**Expect:** Only approved reports. Click **Submitted** as well — both statuses are now
included (status is multi-select).

5. Open **Weeks from**, pick a week; open **Weeks to**, pick a later week.

**Expect:** The list narrows to that range. Each field shows a Monday–Sunday range, and
**Any week** when empty.

6. In the **Weeks from** calendar, click **Clear**.

**Expect:** The field returns to **Any week** and the lower bound is removed.

7. Click **Clear filters**.

**Expect:** Every filter resets and the full list returns.

### F5 — Filters are shareable through the URL

1. Apply a member filter and a status chip.
2. Copy the URL from the address bar, open a **new tab**, and paste it.

**Expect:** The dashboard opens with the **same filters already applied**.

3. Press the browser **Back** button.

**Expect:** You leave the dashboard rather than replaying each filter click one at a time.

### F6 — Not started filter

1. Click the **Not started** chip (right of the divider).

**Expect:** A list of team members who have filed **nothing at all** for the selected week.
Selecting it clears the other status chips, because it answers a different question.

### F7 — Activity feed

**Expect:** A panel listing recent events — submissions, approvals, change requests — each
with who, which week, which project, and a timestamp. Change requests show the comment.

### F8 — The Action column says what you can do

The report list at the bottom of the dashboard has an **ACTION** column. It must never be
blank — a blank cell under that header reads as an unfinished page.

1. Find a row with a **Submitted** badge that is **not** your own report.

**Expect:** A violet **Review** button.

2. Find a row with **Approved** or **Needs correction**.

**Expect:** An outlined **Open** link, not a Review button. There is no decision left to
make, but the report is still readable — and a manager looking at a past week usually wants
to read it.

3. Find a row with a **Draft** badge belonging to **somebody else**.

**Expect:** The muted text **Private until submitted** — and it is deliberately **not** a
link. A draft is private to its author until submitted, so the backend would refuse it; a
link would be a dead end.

4. Find one of **your own** reports in the list (file one as the manager if there isn't one).

**Expect:** **Open**, never Review — a manager cannot review their own submission, so the
button that leads straight to a refusal is not offered. Your own **draft** shows **Open**
too, because it is yours to read.

> The three outcomes exist because "nothing to review" and "nothing you may read" are
> different facts, and an empty cell states neither.

---

## Part G — Compare sections

| # | Test | Result |
|---|---|---|
| G1 | Compare one section across the team | `[ ]` |
| G2 | Members who filed nothing are accounted for | `[ ]` |

### G1 — Compare one section across the team

1. Left navigation → **Compare sections** (or **Compare sections** button on the dashboard).
2. Pick a week and a section.

**Expect:** The chosen section shown for **every** team member who filed, side by side.
Section options: **Blockers**, **Achievements**, **Planned next week**, **Tasks**,
**Hours breakdown**, **Notes & links**.

3. Pick **Blockers** for the week `Test Member` reported one.

**Expect:** Their blocker text appears, with a **Key issue** tag on the flagged one. A member
who filed a report but recorded no blockers reads *No blockers reported.*

4. Each card's header shows the member's name, the project, and the version (`v1`, `v2`…).
   Click a name.

**Expect:** It opens that report.

### G2 — Members who filed nothing are accounted for

Most weeks in a real team have gaps, so the page has to distinguish "filed nothing" from
"filed but had nothing to say".

1. Pick a week where only one or two members filed.

**Expect:** Above the cards, a line reading *Showing **1** of 12 team members — 11 filed
nothing this week.*

2. Scroll below the cards.

**Expect:** A **No report filed (n)** panel listing each of those members as a chip. Clicking
one opens that member's profile and history.

3. Pick a week where **nobody** filed.

**Expect:** *Nothing to compare*, and the description says all N members are still to start —
not a bare empty page.

> Members with no report can never appear as a card, because a card is rendered from report
> content and there isn't any. They come from `GET /api/reports/week-status`, which starts
> from the user list instead of the report list — the same source as the dashboard's week
> panel. Without this panel, a quiet week looked identical to a broken query.

---

## Part H — Member profile (manager view)

| # | Test | Result |
|---|---|---|
| H1 | Open a member's profile from the dashboard | `[ ]` |
| H2 | Counts match the history | `[ ]` |

### H1 — Open a member's profile from the dashboard

1. On the **Team dashboard**, click a member's name (in a chart row or a report row).

**Expect:** URL `/team/<userId>`. The page shows the member's name, their status counts, and
their full report history, paginated.

### H2 — Counts match the history

1. Add up the status counts at the top of the page.

**Expect:** The total equals the number of reports in the history list (check the pagination
total, not just the first page).

---

## Part I — Projects

Manager window → **Projects**.

| # | Test | Result |
|---|---|---|
| I1 | Create a project | `[ ]` |
| I2 | Rename a project | `[ ]` |
| I3 | Duplicate name refused | `[ ]` |
| I4 | Deactivate and reactivate | `[ ]` |
| I5 | Delete only when unused | `[ ]` |

### I1 — Create a project

1. Click **+ New project**.
2. **Name:** `Test Project`, **Description:** `Created by the manual test plan`.
3. Click **Create project**.

**Expect:** A confirmation naming the project, and a new row in the list showing
**No reports yet**.

### I2 — Rename a project

1. On the `Test Project` row, click **Edit**.
2. Change the name to `Test Project Renamed` and click **Save changes**.

**Expect:** A confirmation, and the row shows the new name.

### I3 — Duplicate name refused

1. Click **+ New project** and enter the name of a project that already exists.
2. Click **Create project**.

**Expect:** An error saying the name is taken. Nothing is created.

### I4 — Deactivate and reactivate

1. On `Test Project Renamed`, click **Deactivate**.

**Expect:** The row is marked inactive.

2. Go to **My reports** → **+ New report** and open **Project / category**.

**Expect:** The deactivated project is **not** in the list — you cannot file new work against
a retired project.

3. Back on **Projects**, click **Activate**.

**Expect:** It is selectable on the form again.

### I5 — Delete only when unused

1. Find a project whose row shows a report count (e.g. `11 reports`).

**Expect:** There is **no Delete button** on that row — only **Edit** and **Deactivate**.

2. On `Test Project Renamed` (0 reports), click **Delete**.

**Expect:** The button changes to **Confirm delete** with a **Cancel** beside it.

3. Click **Confirm delete**.

**Expect:** A confirmation and the row disappears.

> Delete is only offered when the count is zero. A project that reports reference can only be
> deactivated, because deleting it would orphan them.

---

## Part J — User management

Manager window → **User management**.

| # | Test | Result |
|---|---|---|
| J1 | The account list | `[ ]` |
| J2 | Add a team member | `[ ]` |
| J3 | Change a role | `[ ]` |
| J4 | Disable and re-enable | `[ ]` |
| J5 | A disabled account cannot sign in | `[ ]` |
| J6 | You cannot administer yourself | `[ ]` |
| J7 | Delete only when the account has no reports | `[ ]` |
| J8 | The last manager cannot be removed | `[ ]` |

### J1 — The account list

**Expect:** Every account with its name, email, role, report count, and an enabled/disabled
state.

### J2 — Add a team member

1. Click **+ Add team member**.
2. **Name:** `Temp Tester`, **Email:** `temp.tester@example.com`,
   **Initial password:** `Temp@1234`, **Role:** `Team member`.
3. Click **Create account**.

**Expect:** A confirmation and a new row with **0 reports**.

> There is no email infrastructure, so a manager sets an initial password directly instead of
> sending an invitation.

### J3 — Change a role

1. On the `Temp Tester` row, change the **Role** select to **Manager**.

**Expect:** It saves immediately and the row shows *Manager*.

2. Change it back to **Team member**.

### J4 — Disable and re-enable

1. On the `Temp Tester` row, click **Disable**.

**Expect:** The row is marked **Disabled** and the button becomes **Enable**.

### J5 — A disabled account cannot sign in

1. While `Temp Tester` is disabled, open a third browser window and try to sign in as
   `temp.tester@example.com` / `Temp@1234`.

**Expect:** *Invalid email or password* — the same message as a wrong password, not "your
account is disabled".

2. Re-enable the account and sign in again.

**Expect:** It works.

> Worth testing carefully: a disabled account is rejected in three separate places in the
> backend, because each one bypasses the others.

### J6 — You cannot administer yourself

1. Find **your own** row in the list.

**Expect:** No **Role** select and no **Disable** button on your own row.

> Demoting or disabling yourself would remove the access needed to undo it.

### J7 — Delete only when the account has no reports

1. Look at a row with a non-zero report count.

**Expect:** No **Delete** button — only **Disable**.

2. On `Temp Tester` (0 reports), click **Delete** → **Confirm delete**.

**Expect:** A confirmation and the row disappears.

### J8 — The last manager cannot be removed

1. If your database has exactly **one** enabled manager, sign in as a second manager (or
   promote one) and try to demote or disable the last remaining manager.

**Expect:** An error from the backend explaining that the change would leave no enabled
manager. Nothing changes.

> Skip this if you have several managers and would rather not reshuffle them — but it is
> worth one attempt, because it is the guard that prevents locking everyone out.

---

## Part K — Profile & settings

Use the **member** window.

| # | Test | Result |
|---|---|---|
| K1 | The profile page | `[ ]` |
| K2 | Edit name and email | `[ ]` |
| K3 | Session survives an email change | `[ ]` |
| K4 | Email already in use | `[ ]` |
| K5 | Wrong current password | `[ ]` |
| K6 | Change the password | `[ ]` |
| K7 | Role is read-only | `[ ]` |

### K1 — The profile page

1. Left navigation → **Profile & settings** (or top-right menu → **Profile & settings**).

**Expect:** Your initials, name and email at the top, then rows for **Name**, **Email**,
**Role**, **Permissions**; a **Password** row with a **Change password** button; and
**Sign out** at the bottom. An **Edit** button sits beside your name.

### K2 — Edit name and email

1. Click **Edit**.

**Expect:** The Name and Email rows become editable fields, with **Save changes** and
**Cancel**.

2. Change the name to `Test Member Renamed` and click **Save changes**.

**Expect:** A green confirmation *Your details have been updated.* The header and the
top-right corner both show the new name.

3. Click **Edit** again, put `Test 123` in the name, and save.

**Expect:** *Name must contain only letters and spaces*.

### K3 — Session survives an email change

1. Click **Edit**, change the email to `test.renamed@example.com`, and click **Save changes**.

**Expect:** A green confirmation.

2. **Without refreshing**, click **My reports**.

**Expect:** Your reports load normally. You are **not** signed out.

> This is the important one. The sign-in token identifies you by email, so changing it must
> hand back a new token. If you get bounced to the login screen here, that is a bug.

3. Sign out, then sign in with the **new** email and your existing password.

**Expect:** It works. The old email no longer signs in.

### K4 — Email already in use

1. Click **Edit** and change your email to another existing account's address
   (e.g. a manager's).
2. Click **Save changes**.

**Expect:** An error saying an account with that email already exists. Your email is
unchanged.

3. Click **Edit**, retype your **own current** email unchanged, and save.

**Expect:** It saves successfully — re-saving your own address must not collide with itself.

### K5 — Wrong current password

1. Click **Change password**.
2. **Current password:** `WrongPass1!`, **New password** and **Confirm new password**:
   `Test@5678`.
3. Click **Update password**.

**Expect:** A red message *Your current password is incorrect.* You stay on the page.

4. Click **My reports**.

**Expect:** You are **still signed in**.

> A wrong password here must not end your session. If you get logged out, that is a bug.

### K6 — Change the password

1. **Change password** → current `Test@1234`, new `Test@5678`, confirm `Test@5678`.
2. Click **Update password**.

**Expect:** A green confirmation *Your password has been changed.* The form closes.

3. Try a mismatched confirmation first, if you like.

**Expect:** *The two passwords do not match*.

4. Sign out. Sign in with the **old** password.

**Expect:** *Invalid email or password*.

5. Sign in with `Test@5678`.

**Expect:** It works.

### K7 — Role is read-only

**Expect:** **Role** and **Permissions** are plain text with no control — a team member
cannot promote themselves here.

---

## Part L — Access control

The security tests. These matter most.

| # | Test | Result |
|---|---|---|
| L1 | A member cannot reach manager pages by URL | `[ ]` |
| L2 | A member cannot open a peer's report | `[ ]` |
| L3 | A manager cannot open a member's draft | `[ ]` |
| L4 | A member cannot review anything | `[ ]` |
| L5 | Signing out clears the session | `[ ]` |

### L1 — A member cannot reach manager pages by URL

Signed in as the **team member**, type each of these in the address bar:

- `/team`
- `/team/sections`
- `/projects`
- `/admin/users`

**Expect:** Each one sends you back to **My reports**. None of them renders, even briefly.

### L2 — A member cannot open a peer's report

1. As the manager, note the **id** of a report belonging to somebody other than
   `Test Member` (from the URL on its detail page).
2. In the **member** window, go to `/reports/<that id>`.

**Expect:** **Report not found** — not "access denied".

> 404 rather than 403 is deliberate: a "forbidden" reply would confirm the report exists and
> let ids be probed one by one.

### L3 — A manager cannot open a member's draft

1. As `Test Member`, create a new draft for a **different** week and **do not submit it**.
   Note its id.
2. In the **manager** window, go to `/reports/<that id>`.

**Expect:** **This report is still a draft** — the content is not shown.

> A draft is private to its author until submitted, including from a manager.

### L4 — A member cannot review anything

1. In the **member** window, go to `/review/<any report id>`.

**Expect:** You are redirected to **My reports** — the route is manager-only.

### L5 — Signing out clears the session

1. Sign out.
2. Press <kbd>F5</kbd>, then try `/reports` directly.

**Expect:** The login screen both times.

---

## Part M — AI assistant (optional feature)

Manager window. **Skip this entire part if `GEMINI_API_KEY` is not configured** — the feature
is optional and everything else works without it.

| # | Test | Result |
|---|---|---|
| M1 | The widget appears for a manager only | `[ ]` |
| M2 | Ask a question | `[ ]` |
| M3 | It refuses a private draft | `[ ]` |
| M4 | Week in review summary | `[ ]` |
| M5 | Unconfigured state | `[ ]` |

### M1 — The widget appears for a manager only

**Expect (manager):** An **Ask the assistant** button in the bottom-right corner, **enabled**.

**Expect (team member):** No such button anywhere.

1. Open DevTools → **Network**, then load any page as a manager.

**Expect:** **No request to `/api/assistant/status`.** It is only made when you open the
panel — an error page in particular must not call the API. See N1.

2. Click **Ask the assistant**.

**Expect:** The request goes out now. The header briefly reads *Checking…* — never
*Not configured* before the answer is known — then settles on either the model name or the
not-configured notice.

### M2 — Ask a question

1. Click **Ask the assistant**.
2. Click the suggestion *How many reports are waiting for my review?*

**Expect:** A spinner *Looking it up…*, then a plain-prose answer with real numbers, and
small grey chips underneath naming the lookups used (e.g. *week overview*, *report list*).

> Those chips are how you check an answer. A figure with no chip beneath it did not come from
> your data.

### M3 — It refuses a private draft

1. Ask: `Show me the content of report <id>` using the **draft id from L3**.

**Expect:** It explains in plain language that the report is still a draft and private to its
author. It must **not** show the content.

### M4 — Week in review summary

1. Close the widget. On **Team dashboard**, find the **Week in review** card.
2. Click **Summarise this week**.

**Expect:** Three labelled sections — completed work, recurring blockers, workload balance —
plus a line saying how many reports it read.

3. Change the week with the week picker.

**Expect:** An amber warning that the summary covers a different week, and the button becomes
**Regenerate**.

### M5 — Unconfigured state

Only if you want to check it: stop the backend, unset `GEMINI_API_KEY`, restart.

**Expect:** The **Ask the assistant** button is still visible and still opens. The panel
explains that the assistant needs `GEMINI_API_KEY`, and the input is disabled. Every other
page works normally.

> The button is deliberately **not** disabled up front: whether the assistant is configured
> is only known after the panel is opened, and a button greyed out by a probe that has not
> run yet just looks broken.

> **Free-tier quota.** A few questions in quick succession will hit a rate limit and the UI
> will ask you to wait a minute. The daily allowance is small (roughly 20 requests, and one
> question costs two or more), and it resets at midnight US Pacific — about **12:30 PM IST**.
> Do not burn it right before recording a demo.

---

## Part N — Layout, responsiveness, error pages

| # | Test | Result |
|---|---|---|
| N1 | The 404 page | `[ ]` |
| N2 | Sidebar collapse | `[ ]` |
| N3 | Mobile layout | `[ ]` |
| N4 | No sideways page scroll | `[ ]` |

### N1 — The 404 page

1. While signed in, go to `/reports/9999/nonexistent`.

**Expect:** A centred card: a magnifier icon, a large violet **404**, heading *We couldn't
find that page*, a sentence about the link being out of date, the path you asked for shown in
a mono chip, and a **Back to my reports** button.

**Expect (manager):** The footer also links to **team dashboard** and **projects**.

**Expect (team member):** The footer instead offers **Start a new report**.

2. Do the same **as a manager**, by typing a nonsense path such as
   `/reports6b5dgbd/34` into the address bar.

**Expect:** The 404 page, exactly as for a team member. You must **not** be redirected to the
login screen.

> This used to happen. The assistant widget lives in the app shell and probed
> `GET /api/assistant/status` on every full page load — including on the 404 page, which
> otherwise touches the API not at all. Once a session passed its **one-hour** expiry that
> probe came back 401, the API client signed the user out, and a manager who mistyped a URL
> landed on the login screen. A team member saw the page correctly, because nothing on it
> called the API. The probe now runs when the assistant panel is opened, not on load.
>
> A genuinely expired session **will** still sign you out on your next real action — that is
> correct. The fix is that an error page no longer triggers it.

### N2 — Sidebar collapse

1. Click **Collapse** at the bottom of the left navigation.

**Expect:** The sidebar narrows to icons only. Reload the page — it stays collapsed.

2. Expand it again.

### N3 — Mobile layout

1. Open DevTools (<kbd>F12</kbd>) → device toolbar → a phone size such as 390 × 844.
2. Visit **My reports**, **New weekly report**, **Team dashboard**, **Profile & settings**.

**Expect:** The sidebar becomes a hamburger menu. **My reports** switches from a table to
stacked cards. The week picker calendar fits on screen. Nothing is cut off at the right edge.

### N4 — No sideways page scroll

1. Still at phone width, on each page, try to drag the page left and right.

**Expect:** The **page** does not scroll sideways. The only thing that scrolls horizontally
is the task table, inside its own box.

---

## Troubleshooting

Check here before filing a bug — these are environment problems, not defects.

| Symptom | Cause | Fix |
|---|---|---|
| `401 Invalid email or password` on a demo account (`maya.sharma@`, `sofia.rossi@`, …) | The seeder skipped because the `users` table was not empty, so those accounts were never created | Use your own accounts — see [Accounts you will need](#3-accounts-you-will-need) |
| Every request returns `403` | The frontend is on port **5174**, not 5173, and the backend's CORS allows only 5173 | Stop whatever holds 5173 and restart `npm run dev` |
| `Cannot reach the server. Is the backend running?` | Backend not started, or still booting | Wait for `Started WeeklyReportBackendApplication` |
| Backend fails at startup with a missing-table error | Flyway did not run | Check the backend log for Flyway lines; the schema is owned by migrations, not Hibernate |
| An action fails with `500 Something went wrong`, or a row you deleted stays | **The backend is running older code than the frontend.** A call to an endpoint that build does not have comes back 405 (or 500 on older builds) | Restart the backend. Compare its start time with `target/classes` — see below |
| Assistant answers with a rate-limit message | Gemini free-tier quota | Wait a minute; the daily allowance resets ~12:30 PM IST |
| A page is blank with a red console error | A genuine bug | File it — include the console text |

### Is the backend running the current code?

Worth checking first whenever a **newly added** feature fails, because everything else about
the app looks healthy:

```powershell
# When did the running backend start?
$c = Get-NetTCPConnection -LocalPort 8080 -State Listen | Select-Object -First 1
(Get-Process -Id $c.OwningProcess).StartTime

# When was the code last compiled?
(Get-Item "backend\weekly-report-backend	arget\classes\com	echnical	ask\weeklyreportbackend\controller\ReportController.class").LastWriteTime
```

If the compile time is **later** than the start time, the running server predates the change.
Stop it and run `.\mvnw spring-boot:run` again. Spring Boot does not hot-reload new
endpoints; a frontend calling one that isn't there yet gets a **405** and the action silently
does nothing.

---

## Issues found

Copy this block for each problem, and hand the whole section back for fixing.

```
### BUG-01 — <one-line summary>
- **Test:** <e.g. K3>
- **Account / role:** <e.g. team member, test.renamed@example.com>
- **Expected:** <what this document says should happen>
- **Actual:** <what happened>
- **Steps, if different from the test:** <...>
- **Screenshot / console error:** <paste, or say none>
```

Useful extras when you have them:
- Anything red in the browser console (<kbd>F12</kbd> → **Console**).
- The failing request in <kbd>F12</kbd> → **Network**: its URL, method, and status code.
- Whether it happens every time or only sometimes.

| ID | Test | Summary | Status |
|---|---|---|---|
| BUG-01 | G1 | Compare sections gave no sign that most of the team had filed nothing, so one card read as a broken page | **Fixed** — coverage line + "No report filed" panel |
| BUG-02 | B4b | Scrolling the mouse wheel over a focused number field silently changed its value | **Fixed** — the field blurs on wheel, in `TextField` |
| BUG-03 | B11 | No way to delete a draft — a mistaken or abandoned draft stayed forever | **Fixed** — `DELETE /api/reports/{id}` plus multi-select on My reports |
| BUG-04 | B11 | The delete popup opened in the top-left corner instead of centred | **Fixed** — Tailwind preflight's `margin: 0` overrode the UA rule that centres a modal `<dialog>` |
| BUG-05 | B11 | The popup could not be closed, and was left reading *Delete 0 drafts?* after a delete | **Fixed** — rebuilt as a portal overlay that unmounts when closed, so closing is not a state to get wrong |
| BUG-06 | B11 | Confirming the delete left the row in place | **Not a code bug** — the backend predated the endpoint. But the wrong HTTP method returned `500 Something went wrong`, which hid it, so that is now a 405 |
| BUG-08 | N1 | As a manager, a mistyped URL redirected to the login page instead of showing the 404 page; a team member saw it correctly | **Fixed** — the assistant status probe ran on every page load and 401'd on an expired token, signing the user out. It now runs when the panel opens |
| BUG-07 | F8 | The dashboard's ACTION column was blank for Draft and Approved rows | **Not a bug** — Review only applies to a submitted peer report. But blank read as unfinished, so the cell now shows **Open** or **Private until submitted** |

---

## Change log for this document

| Date | Change |
|---|---|
| 2026-09-09 | First version, written against `bug/bug-fixing`. |
| 2026-09-09 | Added A9 — password show/hide toggle on the sign-in and sign-up forms. |
| 2026-09-09 | **Fixed:** the demo-account credentials were listed before the condition that creates them, so testers tried passwords for accounts that did not exist. Section 3 now leads with a query to check which accounts are really there, and offers a password reset or a demo reload. Added a Troubleshooting section. |
| 2026-09-09 | **Fixed:** §3 now records the three accounts on this machine with a working password, verified through `POST /api/auth/login`, plus the two places Parts B–D differ when reusing an account that already has reports. |
| 2026-09-09 | **Fixed again:** the working credentials are now the first thing in §3, and the demo-account table is labelled as not applying to this machine. Testers were reaching the demo table first and hitting 401 twice. |
| 2026-09-10 | **Added (BUG-03):** drafts can now be deleted — checkboxes and select-all on My reports, `DELETE /api/reports/{id}` on the backend, refused with 409 for anything already submitted. Added tests B11 and B12. |
| 2026-09-10 | **Fixed (BUG-08):** the assistant widget probed its status endpoint on every full page load, so on an expired session a manager hitting the 404 page was signed out and redirected to login — a team member was unaffected because that page makes no API calls. The probe is now deferred to when the panel is opened. Updated N1, M1 and M5. |
| 2026-09-10 | **Improved (BUG-07):** the dashboard's ACTION column was empty for any row that could not be reviewed, which looked unfinished. It now shows **Review**, **Open**, or **Private until submitted** — the last is not a link, because a peer's draft is refused by the backend. Added test F8. |
| 2026-09-10 | **Fixed (BUG-06):** a wrong HTTP method fell through to the catch-all handler and became `500 Something went wrong`, so a frontend calling DELETE against a backend that had not been restarted looked like a broken server. It is now a 405 naming the allowed methods. Added three integration tests covering the whole delete path through the real filter chain — unit tests all passed because none of them goes through the dispatcher. Added a Troubleshooting entry for stale-backend symptoms. |
| 2026-09-10 | **Fixed (BUG-04, BUG-05):** the confirmation popup opened in the top-left corner and then could not be closed — `showModal()` was not taking effect, so it showed without a backdrop and `close()` had nothing to close, leaving it stuck open over a cleared selection. Rebuilt as a portal-rendered overlay that returns null when closed. It is also now gated on the selection being non-empty. Added B11 steps 11-12. |
| 2026-09-10 | **Changed:** the delete confirmation is now a modal popup (**No** / **Yes, delete**) rather than an inline button swap. B11 steps 5-10 rewritten to cover it, including Escape, the backdrop click and where focus starts. |
| 2026-09-10 | **Fixed (BUG-02):** the mouse wheel silently changed any focused number field — Planned %, Actual %, both hour columns and the hours grid. Added test B4b. |
| 2026-09-09 | **Fixed (BUG-01):** Compare sections showed one card for a week with one report and no indication that eleven members had filed nothing, so a quiet week looked like a broken query. It now shows an "n of m team members" line and a "No report filed" panel. Added test G2, and G1 now covers the card header. |
