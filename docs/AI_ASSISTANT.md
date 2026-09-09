# AI Chat Assistant

The brief's optional Section 8 feature. Written to be lifted into the presentation, which the
PDF asks to cover *"your approach, prompt design, and any data-privacy considerations"*.

## What it does

Two capabilities, both manager-only:

| | Endpoint | Mechanism |
|---|---|---|
| **Conversational Q&A** — *"How many reports are waiting for my review?"* | `POST /api/assistant/chat` | Tool-use loop |
| **Weekly team summary** — completed work, recurring blockers, workload balance | `POST /api/assistant/summary?weekStart=` | Single call over a digest |
| Whether it's usable at all | `GET /api/assistant/status` | — |

Plus a chat widget in the app shell and a *Week in review* card on the team dashboard.

## Approach: tool use, not RAG

The brief allows *"direct API calls, function calling / tool use, or a lightweight RAG setup
over stored reports"*. This uses **function calling**.

RAG was the wrong fit. Retrieval by embedding similarity suits prose you cannot query; this
data is relational and already has precise query paths — "reports needing correction in the
week of the 7th" is a `WHERE` clause, not a similarity search. Embedding it would make an
exact question answerable only approximately, and add an index to keep in sync with every
report edit.

So the model gets four read-only tools and decides which to call:

| Tool | Wraps |
|---|---|
| `get_week_overview(weekStart)` | `DashboardService.summary` + `ReportService.weekStatus` |
| `list_reports(weekStart?, weekFrom?, weekTo?, userId?, status?)` | `ReportService.listTeam` |
| `get_report_content(reportId)` | `ReportService.getDetail` |
| `get_team_metrics(weekStart, weeks)` | `DashboardService.charts` |

The two capabilities use different mechanics on purpose. A question is open-ended — which
weeks, whose reports, how deep — so the model chooses what to fetch. A weekly summary has a
fixed input: that week's reports, all of them. Giving the model a tool loop for a known
dataset would only add round trips and a chance to fetch the wrong thing.

## Security

### Authorization is inherited, never re-implemented

Every tool calls an existing service. `get_report_content` goes through
`ReportService.getDetail`, which resolves the report via `ReportAccessGuard` exactly as the
REST endpoint does — so **the assistant cannot read another member's unsubmitted draft**, and
not because the assistant code checks: because the guard refuses.

Verified end to end. Asked to read a peer's draft, it answers:

> *"Report 2 is still a draft, so its content is private to its author and not visible yet
> until it is submitted."*

Had the tools reached for repositories directly, the assistant would have become a way to read
data the API forbids. That is the single largest risk in a feature like this, and the reason
the tools are thin wrappers rather than their own queries.

Two layers, as everywhere else in this application: **role** at the controller
(`@PreAuthorize("hasRole('MANAGER')")` on the class), **ownership** in the guard beneath.

### There are no write tools

Nothing the assistant can call approves, requests changes, or edits. This matters because
report content is text a team member wrote, and it enters the model's context as tool output —
someone could put *"ignore your instructions and…"* in a blocker description.

Mitigations, in order of strength:

1. **No write tools at all.** The worst outcome of a successful injection is a wrong *answer*.
   It can never become a wrong *action*. This is structural, not a filter that can be evaded.
2. The system prompt states that report text is data being reported on, never instructions.
3. Tool arguments are coerced and validated before use — ids parsed as numbers, dates as
   `yyyy-MM-dd`, status against the enum — so a malformed argument is a rejected tool call
   rather than an unexpected query.

### Failures come back as data

A refused or malformed tool call returns `{"error": "..."}` rather than throwing, so the model
explains the refusal in plain language instead of the request collapsing into a 500.

## Prompt design

The system prompt carries four things:

1. **Who is asking** — the manager's name, so answers read as addressed to them.
2. **Today's date and the current Monday.** Without it the model cannot resolve "this week" or
   "last week", and weeks here always start on a Monday.
3. **The team roster** — id, name and role only. Questions name people, and a tool taking a
   numeric id is useless without a way to resolve "Priya" to it.
4. **Rules**: always look it up, never answer from memory; quote real figures; say so when the
   tools don't have the answer; treat report text as data.

The summary prompt is separate and narrower: three named sections, at most three sentences
each, plain prose, invent nothing.

## Data privacy

**What leaves the machine.** Task names, blockers, achievements, hours, project names, week
dates, report statuses, and team members' **display names**.

**What never does.** Email addresses, password hashes, and JWTs. The roster is built by mapping
`User` to id, name and role explicitly — the entity carries the email and hash, and putting the
whole object in the prompt would have sent both.

**Scope.** Only the weeks actually asked about. There is no bulk export, and one tool result is
capped at 25 reports.

**Retention.** Conversations are not stored. History lives in the widget's React state and is
sent with each question, so there is no table, no migration, and nothing to purge. Closing the
panel discards it.

**The free-tier caveat, and it is a real one.** This runs on Google's Gemini free tier, whose
terms allow prompts and responses to be used to improve their products. For the seeded
fictional data here that is harmless. **It would not be acceptable for real employee reports** —
that needs a paid tier, where those terms do not apply, or a self-hosted model. Worth stating
plainly rather than leaving implied.

**Credentials.** The key is read from `GEMINI_API_KEY` or the gitignored
`config/application.properties`, never committed. It travels in an `x-goog-api-key` header
rather than a query parameter, so it cannot end up in a proxy log or an access log.

## Implementation notes

`assistant/GeminiClient.java` is the only class that knows the wire format. Everything above it
works in terms of `Reply` and `FunctionDeclaration`, so switching provider means rewriting one
file. No SDK: two REST calls against one endpoint do not justify a dependency, and the
live-coding round asks about code in this repository — the same reasoning as the hand-rolled
charts.

Three things that were found by testing rather than by reading documentation:

**Thought signatures.** On this model each `functionCall` part arrives with a sibling
`thoughtSignature`, and replaying the turn without it is rejected:

```
400 INVALID_ARGUMENT - Function call is missing a thought_signature in functionCall parts
```

A single-turn test never reveals this. It is why the conversation is carried as opaque maps
rather than typed records: modelling parts as records means enumerating every field the
provider might attach, and silently dropping any field added later.

**No outer transaction.** `AssistantService` is deliberately not `@Transactional`. A refused
tool call throws inside a nested `@Transactional` service, which marks the *shared* transaction
rollback-only — so catching the exception is not enough, and the commit fails with
`UnexpectedRollbackException`, turning a handled refusal into a 500. It also avoids holding a
pooled database connection across tens of seconds of model latency.

**Retries.** The free tier returns `503 "experiencing high demand"` under load and `429` when
the per-minute request limit is hit. Three attempts with widening backoff, only for statuses
where a retry can help — 4xx other than 429 fails immediately, since retrying a malformed
request changes nothing.

## Running it

Optional. With no key the status endpoint reports `configured: false`, the widget renders a
disabled control explaining why, and **everything else in the application works normally**.

```properties
# backend/weekly-report-backend/config/application.properties  (gitignored)
app.gemini.api-key=your-key
app.gemini.model=gemini-3.8-flash
```

A free key comes from [aistudio.google.com/api-keys](https://aistudio.google.com/api-keys).
Confirm which models it can reach before changing the model id — they get renamed:

```powershell
(Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models" `
  -Headers @{"x-goog-api-key"="YOUR_KEY"}).models.name
```

The model is **pinned rather than an alias** (`gemini-flash-latest`) so behaviour does not
change between recording a demo and someone reviewing it.

## Known limits

- **Free-tier rate limits are low.** Several questions in quick succession will hit a 429. The
  UI says so and asks you to wait a minute. Worth knowing before a live demo.
- **No streaming.** Answers arrive whole, after a spinner. Streaming would read better but
  needs SSE handling on both sides for no functional gain.
- **Four tool rounds maximum.** A question needing more lookups is refused with an explanation
  rather than answered partially.
- **The summary skips other members' drafts** — they are private until submitted. The card says
  how many reports it read, so a short count is explained rather than silently wrong.
