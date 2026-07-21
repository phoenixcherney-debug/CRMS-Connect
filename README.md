# CRMS Connect

The private opportunity board for **Colorado Rocky Mountain School** (Carbondale, CO).
Alumni and parents post internships, mentorships, shadow days, and first jobs they'd
never put on a public job board — because this one is only for their school.

**The whole product is one loop:**

1. A **member** (alum / parent / faculty / friend, individually approved by CRMS staff)
   posts an *offer* — as small as one shadow day for one student.
2. A **student** *raises a hand* with a short note. No resume, no cold outreach.
3. They talk in a **request thread** scoped to that offer — always readable by
   school **staff**.
4. The member accepts; the offer fills; the school can see it happened.

## Trust model (why it's built this way)

Most users on the student side are minors, so the rules are structural, not policy:

- **No public surface.** Nothing behind login is visible without an approved account.
- **Adults are vetted one by one.** Member accounts are `pending` until staff approves
  them (students with an `@crms.org` email activate immediately).
- **Students always initiate.** There is no student directory for members and no way
  for an adult to start a conversation.
- **No open DMs.** The request thread is the only messaging surface, and staff can
  read every thread (`/admin/requests`).
- **No contact info.** Emails/phones never render anywhere in the app.
- **Everything moderated is audited.** Approvals, disables, unlistings, and report
  resolutions land in `audit_log` automatically via triggers.

These rules are enforced in Postgres (RLS + `SECURITY DEFINER` guard triggers), not
just in the UI — see `supabase/migrations/`.

## Stack

React 19 + TypeScript · Vite 7 · React Router v7 · Tailwind CSS v4 · PWA
(`vite-plugin-pwa`, generateSW) · Supabase (Postgres + Auth) · Vercel ·
Vitest + Playwright.

No edge functions, no push, no storage buckets — v2 deliberately has a small surface.

## Roles

`student | member | admin` (`user_role` enum). Members carry an `affiliation`
(alumni / parent / faculty_staff / friend) shown beside their name everywhere —
identity is the trust signal. Admins are provisioned in SQL only (`role = 'admin'`
can never be reached from the app; see `enforce_profile_guard`).

## Development

```bash
npm install
cp .env.example .env   # fill in Supabase URL + anon key
npm run dev
```

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` + production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `npm run e2e` | Playwright suite (`e2e/`); needs `E2E_PASSWORD` / `E2E_STAFF_PASSWORD` in `.env` |

Run e2e against any deployment with `E2E_BASE_URL=https://… npm run e2e`.

## Project layout

```
supabase/migrations/   single squashed v2 schema (tables, RLS, triggers, RPCs)
supabase/seed.sql      demo community (passwords via psql -v, never committed)
src/pages/{public,student,member,admin,shared}/
src/components/ui/     primitives (Button, Card, Field, Modal, Toast, …)
src/types/             domain types + enum → label/tint maps
SPEC.md                product spec — the source of truth for scope and design
```
