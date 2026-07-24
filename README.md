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

One edge function (`send-push`), no storage buckets — v2 keeps a deliberately small
surface. Notifications are in-app first; web push is an explicit opt-in (see below).

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
| `npm test` | Vitest unit tests (`src/**/*.test.ts`). Integration + e2e run separately (below) and are required CI gates. |
| `npm run test:integration` | RLS trust-model tests against the live DB (`integration/`); needs the Supabase URL/keys + `E2E_PASSWORD` / `E2E_STAFF_PASSWORD` in `.env`. **Fails loudly** when any are missing — it never skips silently. |
| `npm run e2e` | Playwright suite (`e2e/`); needs `E2E_PASSWORD` / `E2E_STAFF_PASSWORD` in `.env` |

Run e2e against any deployment with `E2E_BASE_URL=https://… npm run e2e`.

## Deployment invariants

These must hold on the live Supabase project. The trust model assumes them and CI
can't set them, so verify them before each deploy:

- **Email confirmation must be ENABLED** (Supabase → Auth → Providers → Email →
  "Confirm email"). Student auto-activation trusts a `@crms.org` address only once
  `email_confirmed_at` is set. If confirmations are disabled, that column is populated
  at signup, so anyone typing any `@crms.org` string would activate immediately without
  proving they control the mailbox.
- **Auth minimum password length ≥ 8** (Supabase → Auth → Policies). The 8-char rule is
  enforced in the signup/reset UI; set the server-side minimum to match so a direct API
  call to `signUp` / `updateUser` can't create a weaker password. Enabling
  leaked-password protection is recommended too.
- **Never run `supabase/seed.sql` against a database with real users.** It provisions
  demo accounts (including a demo admin) with shared, known passwords for tests/handoff.
  Keep it non-prod, give the demo admin a unique per-environment password, and rotate any
  shared demo/staff password after a handoff.

## Notifications & opt-in push

Every meaningful event writes an in-app notification (a `notifications` row, created
only by `SECURITY DEFINER` triggers — never the client). The bell polls the unread
count; the list marks read on view.

Web push is layered on top and is **off by default** — the app never requests
notification permission on load. A user turns it on per device from the Notifications
page ("Push notifications" card). When a notification is written, the `dispatch_push`
trigger fires the `send-push` edge function *only* if that user has a subscription.

**Enabling push (one-time, owner action — needs secret values this build never sets):**

1. Generate a keypair: `npx web-push generate-vapid-keys`.
2. Supabase → Edge Functions → `send-push` → Secrets, set:
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (from step 1)
   - `VAPID_SUBJECT` (e.g. `mailto:connect@crms.org`)
   - `PUSH_HOOK_SECRET` — copy the value already generated in Vault:
     `select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret';`
3. Vercel → project env: `VITE_VAPID_PUBLIC_KEY` = the same public key; redeploy.

Until those are set the toggle stays hidden and `dispatch_push` no-ops safely — the
trigger→function wiring is live (verified end-to-end), it just needs the keys.

## Project layout

```
supabase/migrations/   single squashed v2 schema (tables, RLS, triggers, RPCs)
supabase/seed.sql      demo community (passwords via psql -v, never committed)
src/pages/{public,student,member,admin,shared}/
src/components/ui/     primitives (Button, Card, Field, Modal, Toast, …)
src/types/             domain types + enum → label/tint maps
SPEC.md                product spec — the source of truth for scope and design
```
