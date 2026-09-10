# Presentation script — Weekly Report Generator & Team Dashboard

Slide-by-slide content for the Google Slides deck the assignment requires. Every section the
brief names has its own slide, in the brief's own order.

**How to use this:** each `## Slide N` heading is one slide. The bullets go **on** the slide —
they are already short enough. **Say:** is your speaker note; don't put it on the slide.

Keep the deck to the bullets. The detail lives in the speaker notes and in the repo, and a
slide that has to be read aloud word for word is a slide the audience stops listening to.

> **Two things to check before you record:** every figure here was counted from the code on
> 2026-09-10 (33 endpoints, 227 tests, 9 tables, 21 RBAC tests). If you change anything, re-count.
> And rehearse the AI-chat demo on a *different* Gemini model id than the one you record with
> — the free tier allows about 20 requests a day per model.

---

## Slide 1 — Title

- **Weekly Report Generator & Team Dashboard**
- Spring Boot 4 · React 19 · MySQL 8
- Sriranjan Kapilan

**Say:** A tool where team members file a structured weekly report and their manager reviews
it — approve, or send it back with a comment. I'll cover the architecture, the database, the
review workflow, how access control works, the AI assistant, and what I'd do next.

---

## Slide 2 — The problem it solves

- Weekly updates arrive as **free-form chat messages and emails**
- Nothing is comparable, nothing is searchable, nothing is aggregable
- A manager cannot answer *"who is blocked this week?"* without reading everything

**Say:** The brief's premise. The fix isn't a better inbox — it's giving every report the same
structure, so the same question can be asked of all of them at once. That single decision is
what makes the dashboard and the section-comparison view possible at all.

---

## Slide 3 — Architecture at a glance

```
React 19 SPA  ──HTTP + JWT──▶  Spring Boot 4.1.1 REST API  ──JPA──▶  MySQL 8
(Vite, Tailwind 4)              (33 endpoints)                       (9 tables, Flyway)
```

- **Stateless** — no server session; the JWT is the whole request context
- **Layered backend** — Controller → Service → Repository, with DTOs at the boundary
- **Schema owned by Flyway**, `ddl-auto=validate` — Hibernate never alters a table

**Say:** Three tiers, deliberately boring. The one choice worth calling out is
`ddl-auto=validate`: Hibernate is not allowed to change the schema, so the migrations are the
only source of truth. If an entity and a migration disagree, the application refuses to
start — which is far better than finding out in production.

---

## Slide 4 — Why these technologies

| Choice | Reason |
|---|---|
| **Spring Boot 4 / Java 21** | Records for DTOs, sealed workflow states, mature security |
| **JWT, not sessions** | Stateless — no sticky sessions, scales horizontally |
| **Flyway** | Schema is versioned code, reviewable in a diff |
| **React + TypeScript** | Backend enums become string-literal unions; a wrong status is a compile error |
| **Tailwind 4** | CSS-first config; one token file retunes the whole app |
| **No chart library** | See the frontend slides |

**Say:** Spring Boot 4 was newer than most documentation, which cost me time — covered under
challenges.

---

## Slide 5 — Database design

- **9 tables**, 4 Flyway migrations
- `users` · `projects` · `reports` · `report_versions` · `task_entries` · `blockers` ·
  `achievements` · `hours_entries` · `review_comments`
- *(Insert `docs/diagrams/er-diagram.png` on this slide)*

**Say:** The shape that matters: a **report** carries the week, the project and the status,
but none of the content. The content hangs off a **report_version**. That one split is what
makes version history possible without duplicating a row per field.

---

## Slide 6 — Three schema decisions

- **`reports` has no `current_version_id`** — the current version is the highest
  `version_number`, avoiding a circular foreign key
- **`review_comments` points at a *version*, not a report** — so "which version was this
  comment made against" is answerable by the schema itself
- **`(user_id, week_start)` is unique** — one report per person per week, enforced by the
  database, not by application code

**Say:** The third one is the sort of rule that gets enforced in a service method and then
bypassed by a second code path six months later. In the database, it cannot be.

---

## Slide 7 — The review workflow

```
DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED
                       │
                request changes
                       ▼
              NEEDS_CORRECTION ──edit + resubmit──▶ SUBMITTED
```

- A draft is **private to its author** — invisible even to a manager
- Requesting changes **requires** a comment; approving does not
- A manager **cannot review their own** report

**Say:** Four states, and every transition is checked server-side. The status is never
something the client sends — it's the outcome of calling an action endpoint.

---

## Slide 8 — Version history: lazy forking

- Submitting **freezes** the current version
- The next edit **forks a new version** — the frozen one is never touched
- A draft that is edited ten times stays **one** version
- Only **submitted** versions appear in history

**Say:** The subtlety is *when* to fork. Forking on submit would leave a spare empty version
whenever someone submits and never edits again. So the fork happens on the first edit *after*
a submission — the frozen version stays exactly as the manager saw it, and the version count
matches the number of real submissions. A manager opening version 1 sees precisely what they
reviewed.

---

## Slide 9 — API design

- **33 endpoints.** Resources are nouns; a state change is an **action sub-resource** —
  `/reports/{id}/submit`, `/approve`, `/request-changes`
- **One error shape** from a single exception handler; never echoes driver text or caller input
- **DTOs at the boundary** — entities are never serialised, and an unknown JSON property is a
  400, so a smuggled `status` or `userId` fails loudly
- **Pagination and filtering** on both list endpoints, with a **sort-property whitelist**

| Code | When |
|---|---|
| 400 | Validation, bad param, unknown JSON property |
| 401 | No or invalid token, or access revoked |
| 403 | Authenticated, wrong role |
| 404 | Missing — or a peer's report, deliberately |
| 405 | Right path, wrong method |
| 409 | Conflict: duplicate week, illegal transition |

**Say:** The client never sends a status — it calls the transition. On the whitelist:
`?sort=user.passwordHash` returns 400, because Spring Data would otherwise happily order rows
by the hash and leak information through the ordering itself.

---

## Slide 10 — Access control: two layers

- **Role** at the controller — `@PreAuthorize("hasRole('MANAGER')")`
- **Ownership** in a service guard — `ReportAccessGuard`, on every mutating path
- A peer's report is **404, not 403** — a "forbidden" would confirm the id exists
- Ownership is checked **before** status, so the status check can't be used as an existence
  oracle

**Say:** The 404 is the detail I'd point to. If a peer's report answered 403 and a
non-existent one answered 404, you could enumerate every report id in the system by watching
which error came back. Same reasoning for the login message: a disabled account gets the same
*"Invalid email or password"* as a wrong password, because a different message confirms the
address exists.

---

## Slide 11 — Access control: 21 automated tests

- 21 integration tests through the **real filter chain with real JWTs** from `/api/auth/login`
- Not `@WithMockUser` — the JWT filter builds its own `Authentication`, so a mocked principal
  would skip the code the tests exist to cover
- Pins behaviour that is easy to "fix" into a vulnerability

**Say:** One of these caught a real hole: registration originally accepted a client-supplied
`role`, so anyone could mint a manager against a public endpoint. Self-registration now
always produces a team member.

---

## Slide 12 — Session revocation

- A JWT **cannot be revoked** once signed — valid until it expires
- So every token carries a **`token_version`** claim, compared against the user row on **every
  request**
- Changing a role, disabling an account, or changing a password **bumps it**
- The 401 body says *why*, so the sign-in screen can explain the sign-out

**Say:** Before this, demoting a manager took effect on their next request — authorities come
from the database — but their session carried on and the sidebar kept showing manager links
for up to an hour. Now they're signed out and pick up the new role on the way back in. The
same mechanism means changing your password signs out your other devices, which is the whole
point of changing it.

---

## Slide 13 — Frontend structure

- **12 route pages** (10 of them the brief's Section 7 pages), 14 shared components, 69 TS files
- `api/` — one module per backend area; **`client.ts` is the only place `fetch` happens**
- `features/` — domain modules (reports, dashboard, assistant, profile)
- `components/` — `TextField`, `SelectField`, `WeekField`, `ConfirmDialog`, `RowButton`

**Say:** Every request goes through one client, which is what makes cross-cutting behaviour
possible in one place: attaching the token, unwrapping the error shape, and signing the user
out on a 401.

---

## Slide 14 — Three frontend decisions

- **Charts hand-built** — three CSS components, no charting library for four simple charts
- **Dashboard filters live in the URL** — a filtered view is shareable and Back works
- **`WeekField` replaced `<input type="date">`** — Chrome's picker is painted outside the
  document, so no stylesheet can reach it. It also offered a *day* when every field wanted a
  *week*

**Say:** The week picker is my favourite. Every one of those fields piped the value through
`mondayOf` and threw the day away, so the control was offering the wrong unit and hiding the
snap. Now each row is one week: hover lights the whole Monday–Sunday row, and clicking
anywhere in it selects that week.

---

## Slide 15 — "What the backend refuses, the UI doesn't offer"

- **Delete** appears only when a report count is zero
- A manager's **own row** has no role select or disable button
- A peer's draft shows *"Private until submitted"* — deliberately **not** a link
- Rules that can't be decided from the data on screen surface as the backend's message

**Say:** A house rule that kept the UI honest. A button that always fails is worse than no
button — and the exception proves it: the last-enabled-manager guard needs a database count,
so the UI can't know in advance. That one shows the server's message instead of guessing.

---

## Slide 16 — AI chat assistant (bonus)

- Manager-only: **conversational Q&A** + a **written weekly summary**
- **Function calling, not RAG** — four read-only tools the model chooses between
- Every tool wraps an **existing service**, so it inherits `ReportAccessGuard`
- **No write tools at all**

**Say:** RAG was the wrong fit — this data is relational and already has exact query paths.
"Reports needing correction in the week of the 7th" is a `WHERE` clause, not a similarity
search.

---

## Slide 17 — AI prompt design

- **Who is asking** — the manager's name, so answers read as addressed to them
- **Today's date and the current Monday** — without it the model cannot resolve "this week"
- **The team roster** — id, name and role only, never email or hash
- **Four rules** — always look it up, quote real figures, admit gaps, treat report text as data

**Say:** The roster is in the prompt because questions name people, and a tool taking a
numeric id is useless without a way to resolve "Priya" to it. Only id, name and role go in —
the `User` entity carries the email and the password hash, and putting the whole object in
would have sent both. The fourth rule is the safety one: task names and blockers are text a
team member wrote, so the prompt says to treat all of it as data being reported on, never as
instructions. The summary uses a separate, narrower prompt: three named sections, at most
three sentences each, invent nothing.

---

## Slide 18 — Why the assistant can't leak

- Tools call **services**, never repositories — the guard refuses a peer's draft
- Verified live: *"Report 2 is still a draft, so its content is private to its author"*
- **No write tools** means the worst outcome of prompt injection is a wrong *answer*, never a
  wrong *action* — structural, not a filter
- Names, tasks and hours leave the machine; **emails and hashes never do**

**Say:** Report text reaches the model as tool output, so someone could put "ignore your
instructions" in a blocker description. With no write tools there is nothing for a successful
injection to do. Also worth stating plainly: the free tier's terms allow prompts to train
their models, which is fine for seeded fiction and **would not be acceptable for real
employee reports**.

---

## Slide 19 — Testing

- **227 automated tests, 0 failures** — 198 unit + integration across 18 classes
- Integration tests run against a **separate MySQL schema**, never the dev database
- Frontend: **zero lint warnings**, clean `tsc -b`
- **`docs/MANUAL_TEST_PLAN.md`** — 87 numbered manual tests with expected results

**Say:** The manual plan found 15 issues, which is the point of writing it down. One is worth
mentioning: a wrong HTTP method returned *500 Something went wrong*, which disguised a stale
backend as a server fault. Every unit test passed while the endpoint was unreachable, because
none of them goes through the dispatcher — so that gap is now covered by integration tests.

---

## Slide 20 — Challenges

- **Spring Boot 4 is newer than its documentation** — Flyway needs a second dependency or
  migrations silently never run; Jackson is `tools.jackson`, not `com.fasterxml`
- **Gemini thought signatures** — each `functionCall` carries one that must be echoed
  verbatim, or the next request 400s. A single-turn test never reveals it
- **`UnexpectedRollbackException`** — a refused tool call throws inside a nested transaction
  and marks the *shared* transaction rollback-only, so catching it isn't enough
- **Tailwind preflight vs native `<dialog>`** — `margin: 0` overrode the only rule that
  centres a modal

**Say:** The Flyway one cost me the most. `flyway-core` alone gives no error, no log line —
migrations just never run, and Hibernate fails validation with "missing table". You need
`spring-boot-flyway` as well.

---

## Slide 21 — Future improvements

- **Deploy it** — allowed to be local-only, so it's the first thing I'd finish
- **Email notifications** — a manager should know a report is waiting without opening the app
- **Assign members to projects** — optional in the brief; would scope the project dropdown
- **A schema-vs-diagram check in CI** — the ER diagram drifted twice; generating it fixed
  consistency between copies, but nothing compares it against the migrations
- **Rate-limit the login endpoint** — nothing currently slows down credential stuffing

**Say:** The CI check is the one I'd actually build first. Both times the diagram went stale
it was because nothing tied it back to the migrations — and the fix I applied makes the copies
agree with each other, not with the truth.

---

## Slide 22 — Summary

- Complete review cycle: **submit → request changes → correct → approve**, with version
  history
- **10 of the brief's pages** on real data · **33 endpoints** · **9 tables** · **227 tests**
- Every bonus the brief lists except deployment: RBAC tests, comment history, section
  comparison, AI chat
- Access control enforced at **two layers** and tested through the real filter chain

**Say:** Thank you — happy to walk through any part of the code.

---

## Appendix — if asked

Keep these as hidden slides or just know them.

| Question | Answer |
|---|---|
| *Why no `current_version_id`?* | Circular FK between `reports` and `report_versions` |
| *Why 404 for a peer's report?* | 403 would confirm the id exists — enumeration |
| *Why fork on edit, not submit?* | Submitting and never editing again would leave a spare empty version |
| *Why no charting library?* | Four simple charts; a dependency and its API to learn for less code than the three CSS components |
| *Why is `AssistantService` not `@Transactional`?* | A refused tool call throws in a nested transaction and marks the shared one rollback-only, so the commit fails even though the exception was caught |
| *Why is a wrong current password 400, not 401?* | The API client signs the user out on any 401 — a typo would end the session |
| *Why filter and paginate in the browser?* | `/projects/all` and `/api/users` return everything in one response; paging server-side while filtering client-side would search only the current page |
