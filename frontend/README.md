# frontend (planned — not yet scaffolded)

This folder is reserved for the React SPA. No application code exists here yet —
see `docs/PLAN.md` Phase 0/4 for the scaffolding steps.

**Planned stack:** React + Vite + TypeScript (`.tsx`) + Tailwind CSS.

**Planned structure** (created once scaffolding runs):

```
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── pages/        # route-level screens, see docs/PAGES.md
    ├── components/    # reusable, presentation-only UI
    ├── features/      # domain modules: auth, reports, dashboard, projects, users
    ├── api/           # fetch/axios client, one function per backend endpoint
    ├── hooks/         # useAuth, useDebounce, ...
    ├── context/       # AuthContext
    ├── routes/        # route table + ProtectedRoute
    ├── types/         # TS interfaces mirroring backend DTOs
    └── charts/        # chart components (Recharts by default)
```

Scaffold command (run from this `frontend/` directory, once ready to start Phase 4):

```
npm create vite@latest . -- --template react-ts
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

See `docs/ARCHITECTURE.md` for the reasoning behind this structure and the auth flow.
