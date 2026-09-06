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
├── api/          # one module per backend area; client.ts is the only place fetch happens
├── auth/         # AuthProvider (token + user), useAuth hook, context
├── components/   # reusable UI: Layout, Button, TextField, Alert, StatusBadge
├── lib/          # small helpers (date formatting)
├── pages/        # route-level screens
├── routes/       # ProtectedRoute (auth + role gate)
└── types/api.ts  # TypeScript mirror of the backend DTOs
```

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

Phase 4 (foundation) is done: routing, auth context, API client, role-gated routes, shared
layout, login/register, plus a reports list and team dashboard that read real backend data.
The report create/edit form, report detail, version history and the manager review page are
Phase 5/6 — see `../docs/PLAN.md`.
