# CRMS Connect

A career-connections platform for **Colorado Rocky Mountain School** (Carbondale, CO)
that links students, employer/mentors, and administrators. Students discover and
apply to opportunities, post what they're looking for, and connect with mentors;
employer/mentors post opportunities, review applicants, and offer mentorship;
admins moderate users, content, and reports.

## Tech stack

- **Frontend:** React 19 + TypeScript, Vite 7, React Router v7, Tailwind CSS v4
- **PWA:** `vite-plugin-pwa` (injectManifest) with a custom service worker (`src/sw.ts`)
- **Backend:** Supabase (Postgres + Auth + Edge Functions), `@supabase/supabase-js` v2
- **Hosting:** Vercel (SPA rewrites + security headers in `vercel.json`)
- **Tests:** Vitest (unit, co-located `*.test.ts`) and Playwright (`e2e/`)

## Roles

`student | employer_mentor | admin` (see `src/types/index.ts`). The Postgres
`role_type` enum also carries legacy `alumni`/`parent` values that are no longer
exposed (migrated to `employer_mentor` in migration 019). Admins are provisioned
via SQL, not signup. Authorization is centralized in
`src/components/ProtectedRoute.tsx` and enforced server-side by Supabase RLS.

## Getting started

```bash
npm install
cp .env.example .env        # fill in the VITE_SUPABASE_* values
npm run dev                 # start the dev server
```

### Environment variables

Client (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
Edge-function secrets (set in the Supabase dashboard): `SUPABASE_SERVICE_ROLE_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. See `.env.example`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run check:links` | Verify public footer links resolve |

## Project layout

- `src/pages/` — route components
- `src/components/` — shared UI (incl. `ProtectedRoute`, layout, nav)
- `src/lib/` — helpers (Supabase client, sanitization, CSV, etc.)
- `src/contexts/` — `AuthContext`, `ThemeContext`
- `supabase/migrations/` — ordered SQL migrations
- `supabase/functions/` — Deno edge functions (`send-push`, `validate-signup`)
- `e2e/` — Playwright specs

## Database & migrations

Schema and RLS live in `supabase/migrations/`. Apply with the Supabase CLI
(`supabase db push`) or your deploy pipeline. `db/policies-snapshot.md` documents
the intended RLS posture (treat the live database as the source of truth).
