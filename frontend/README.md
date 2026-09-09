# frontend

React SPA for the Weekly Report Generator & Team Dashboard. Talks to the Spring Boot API in
`../backend/weekly-report-backend` over REST with a JWT.

## Stack

React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · React Router 7

Two things differ from most tutorials, both because of the major versions in use:

- **Tailwind 4 is configured from CSS, not JS.** There is no `tailwind.config.js` and no
  PostCSS step — the `@tailwindcss/vite` plugin does the work, `src/index.css` starts with
  `@import 'tailwindcss'`, and custom tokens live in its `@theme` block. Don't run
  `npx tailwindcss init`; that's the v3 flow.
- **No TypeScript `enum`s.** `tsconfig.app.json` sets `erasableSyntaxOnly`, so the backend's
  enums are string-literal unions in `src/types/api.ts`.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

The backend must be running on `http://localhost:8080` (see the root README). Vite proxies
`/api` to it, so the browser only ever talks to its own origin and CORS never comes up in
dev. To point at a deployed API instead, set `VITE_API_BASE_URL` (e.g. in `.env.local`) to
that API's base URL including `/api`.

```bash
npm run build        # typecheck (tsc -b) then production build
npm run lint         # oxlint
```

## Layout

```
src/
├── api/                # one module per backend area; client.ts is the only place fetch happens
├── auth/               # AuthProvider (token + user), useAuth hook, context
├── components/         # reusable UI: Layout, Button, TextField, WeekField, Alert, StatusBadge
│   └── charts/         # ColumnChart, BarList, StackedBarList - CSS bars, no chart library
├── features/           # domain modules: reports/ (form state, task table, version history),
│                       # dashboard/ (tiles, charts, filters, week picker, activity feed)
├── lib/                # small helpers: format.ts, week.ts, keyed.ts
├── pages/              # route-level screens, one per row of ../docs/PAGES.md
├── routes/             # ProtectedRoute (auth + role gate)
└── types/api.ts        # TypeScript mirror of the backend DTOs
```

Two conventions that are load-bearing rather than stylistic:

- **`lib/keyed.ts`** — fetched data is stored together with the parameters it was fetched
  for, so "is this stale?" is answered during render. Clearing state at the top of a fetch
  effect is the alternative and it is worse twice over: an extra render pass on every
  parameter change, and one frame where the previous week's numbers sit under the new week's
  heading. It also covers URL changes that come from a link or the Back button, where none of
  our own handlers run.
- **The team dashboard keeps every filter in the URL**, not in component state. That makes a
  filtered view shareable, gives the Back button meaning, and is what lets a summary tile be
  an ordinary link that arrives with its filter already applied.
- **Weeks are picked with `components/WeekField.tsx`, not `<input type="date">`.** Two
  reasons, and the second is the one that matters. Chrome paints its date popup outside the
  document, so no stylesheet can reach it: on this dark theme it opens as a white panel in
  the browser's own blue. And a date input offers a *day* when every one of these fields
  wants a *week* — each caller used to pipe the value through `mondayOf` and discard the day.
  `WeekField` selects whole Monday–Sunday rows, so the normalisation the old control hid is
  now what the widget visibly does. It renders through a portal to escape `Card`'s
  `overflow-hidden` and the settled `transform` that `animate-fade-up` leaves behind.

`src/types/api.ts` is kept in sync with the backend DTOs **by hand** — change a DTO there
and change it here.

## How auth works

1. Login/register returns a JWT, which `AuthProvider` stores and hands to the API client.
2. `client.ts` attaches it as `Authorization: Bearer <token>` on every request.
3. Any `401` — including a token that expires mid-session — calls one handler that signs the
   user out, so no individual page has to deal with it.
4. `ProtectedRoute` decides what renders based on the user's role. **This is UX only**: the
   backend re-checks role and ownership on every request, so hiding a route is never the
   thing protecting the data.

The token is kept in `localStorage` so a refresh doesn't sign you out. An httpOnly cookie
would be less exposed to XSS, but it needs CSRF handling and a same-site deployment, which
the stateless-JWT design was picked to avoid — noted as a future improvement.

## Status

Complete. Every page in `../docs/PAGES.md` is built and reads real backend data: login and
register, the report create/edit form, report history, report detail with version history,
the manager review page, the team dashboard with summary tiles and four charts, team member
profiles, project management, user management, profile & settings, and the bonus
section-comparison view.

`npm run build` (typecheck + production build) and `npm run lint` are both expected to be
clean — zero errors, zero warnings.
