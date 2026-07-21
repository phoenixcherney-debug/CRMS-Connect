# CRMS Connect v2 — Product Spec

*The single source of truth for the 2026 rebuild. If code and this document disagree, fix one of them.*

## Thesis

CRMS Connect exists to move opportunities that **never reach the public internet** — the
"my clinic could take one student this summer" kind — from CRMS alumni and parents to
current students. Everything in the product either (a) lowers the effort for a busy adult
to post a half-formed offer, (b) lowers the fear for a student to raise their hand, or
(c) keeps school staff in the loop so parents and the school can trust the platform with
minors. Anything that doesn't do one of those three things is out.

**What v1 got wrong (and v2 cuts):** open 1:1 DMs between adults and students, a social
feed, follows, a marketplace, meeting-slot scheduling, mentor walls/shortlists, student
"pitch" posts, push notifications, resume uploads. Each made the app feel like a generic
network and expanded the unmoderated surface between adults and minors.

## The one loop

1. **A member posts an offer** (2-minute form; can be tiny: one shadow day for one student).
2. **A student raises a hand** — a short note, no resume required.
3. **They talk in a request thread** — scoped to that hand-raise, always readable by school staff.
4. **The member accepts** (or declines kindly — templated copy helps), the offer fills, the school sees it happened.

Mentorship, college chats, and project help are just *kinds of offers* — same loop, no
parallel features.

## Roles & trust model

| Role (`user_role`) | Who | How they get in |
|---|---|---|
| `student` | Current CRMS students | Sign up; auto-active with an `@crms.org` email, otherwise pending until staff approves |
| `member` | Alumni, current/past parents, faculty & staff, friends of the school | Sign up with affiliation (Class of '02 / Parent / Faculty / Friend); **always pending until staff approves** |
| `admin` | School staff | Provisioned via SQL (never via signup) |

- `account_status`: `pending` → `active` → (`disabled` if banned). Pending users can log
  in but see only the Waiting Room page. This is a feature, not friction: "a real person
  at the school checks everyone here" is the product's moat.
- **Affiliation is identity.** Every member displays as "Casey Ortega · Class of '02" or
  "Parent of a current Oyster". No anonymous adults.
- **No public contact info, ever.** Email/phone never render in any UI. Contact happens in
  request threads; if an accepted pair needs to move off-platform, the member says so in
  the thread — which staff can see.
- **No adult→student initiation.** Members cannot browse students or start threads.
  Students always make first contact by raising a hand on an offer.

## Information architecture (routes)

Public: `/` (landing) · `/login` · `/signup` · `/reset-password` · `/privacy`
Pending: `/waiting` (all logged-in pending users are locked to this)
Student: `/home` · `/board` (browse offers) · `/board/:id` (detail + raise hand) · `/requests` (mine) · `/requests/:id` (thread) · `/profile`
Member: `/home` (my offers + incoming hands) · `/offers/new` · `/offers/:id/manage` (interest list, per-request threads) · `/board` (read-only) · `/board/:id` (read-only) · `/requests/:id` (threads on my offers) · `/profile`
Both: `/people/:id` (read-only profile: name, affiliation, class year, org/title, bio — no contact info) · `/notifications`
Admin: `/admin` (dashboard: pending-member queue, open reports, latest offers/requests) · `/admin/people` · `/admin/offers` · `/admin/requests` · `/admin/reports` · `/admin/audit` · plus every non-admin route read-only (admins can open any thread and post as **CRMS Staff**).

Route guards: `RequireAuth` (else → `/login`), then status gate (`pending` → `/waiting`,
`disabled` → `/disabled`), then `RequireRole`. Server-side RLS is the real enforcement;
guards are UX.

## Schema (public schema, rebuilt from zero)

Enums:
- `user_role`: `student | member | admin`
- `member_affiliation`: `alumni | parent | faculty_staff | friend`
- `account_status`: `pending | active | disabled`
- `offer_kind`: `internship | job | shadow_day | mentorship | project_help | career_chat | other`
- `offer_status`: `draft | open | filled | closed`
- `request_status`: `sent | in_conversation | accepted | declined | withdrawn`
- `report_status`: `open | resolved | dismissed`
- `report_target`: `user | offer | message`
- `notification_kind`: `request_received | request_update | message_received | account_update | offer_moderated | report_update`

Tables (all RLS-enabled; `id uuid pk default gen_random_uuid()` unless noted):

**profiles** — `id` (pk, fk `auth.users` cascade), `role user_role`, `account_status`
(default `pending`), `full_name` (1–80), `affiliation` (null for students; required for
members via CHECK), `class_year int` (required for students & alumni via CHECK; student =
expected grad year, alumni = grad year), `title` ≤80, `organization` ≤80, `location` ≤80,
`bio` ≤1000, `tags text[]` ≤10 (member: "what I can help with"; student: interests),
`open_to_requests bool default true` (member pause switch), `created_at`, `approved_at`,
`approved_by fk profiles`.

**offers** — `posted_by fk profiles`, `kind offer_kind`, `title` 4–90, `description`
≤3000, `location_mode` (`in_person | remote | flexible`) + `location_text` ≤80,
`timeframe` ≤80 ("Summer 2027", "Ongoing"), `commitment` ≤80 ("~4 hrs/week", "One day"),
`spots int` 1–20 default 1, `status offer_status default 'open'`, `hidden_at/hidden_by`
(admin moderation), `created_at`, `updated_at`.

**requests** — `offer_id fk offers cascade`, `student_id fk profiles`, `note` 10–1500,
`status request_status default 'sent'`, `decided_at`, `created_at`, `updated_at`.
UNIQUE(`offer_id`,`student_id`).

**messages** — `request_id fk requests cascade`, `sender_id fk profiles`, `body` 1–3000,
`is_staff bool default false` (true when an admin posts), `hidden_at/hidden_by`, `created_at`.

**reports** — `reporter_id`, `target report_target`, `target_id uuid`, `reason` 3–500,
`status report_status default 'open'`, `resolved_by/resolved_at`, `created_at`.

**notifications** — `user_id fk cascade`, `kind`, `title` ≤120, `body` ≤300, `link` ≤200,
`read_at`, `created_at`. Written only by SECURITY DEFINER triggers.

**audit_log** — `actor_id`, `action text`, `target_kind text`, `target_id uuid`,
`detail jsonb default '{}'`, `created_at`. Written by triggers on admin actions.

Helper functions (SECURITY DEFINER, `search_path` pinned, EXECUTE revoked from public
where internal): `app_role()`, `app_is_admin()`, `app_is_active()`,
`handle_new_user()` (auth trigger: builds profile from metadata; `@crms.org` students
auto-active), notification triggers, `enforce_profile_guard()` (non-admins cannot change
own `role`/`account_status`/`approved_*`), request-transition guard, auto-fill trigger
(accepted count ≥ spots → offer `filled`), `community_stats()` (anon-callable aggregate
for the landing page), `admin_overview()` (admin dashboard counts).

### RLS matrix (summary)

| Table | student (active) | member (active) | admin |
|---|---|---|---|
| profiles | SELECT active profiles; UPDATE self (guarded cols) | same | SELECT/UPDATE all |
| offers | SELECT `open/filled` & not hidden | + own drafts; INSERT; UPDATE own (not hidden ones) | all, incl. hide/unhide |
| requests | own: INSERT (offer open, not hidden, self), SELECT, withdraw | SELECT/UPDATE status on own offers' requests | all |
| messages | SELECT/INSERT on own requests (not withdrawn/declined) | same for own offers' requests | all (posts flagged `is_staff`) |
| reports | INSERT; SELECT own | same | all + resolve |
| notifications | own SELECT/UPDATE(read) | same | own only |
| audit_log | — | — | SELECT |

Pending/disabled users: RLS denies everything except own-profile SELECT.

## Design language — "field notes, not job board"

CRMS is a small outdoor-progressive boarding school in Carbondale, CO; its people call
themselves Oysters. The app should feel like the school's own field journal: warm paper,
deep spruce, a confident serif — nothing that resembles LinkedIn.

Tokens (Tailwind v4 `@theme` in `src/index.css`):
- `--color-paper: #f7f4ed` (app bg) · `--color-card: #fffdf8` · `--color-ink: #24312a` ·
  `--color-faint: #6b7a70` · `--color-line: #e2dccd`
- `--color-pine: #1e4d3b` (primary) · `--color-pine-deep: #143528` (hover) ·
  `--color-clay: #b4552d` (accent, sparingly: hand-raise CTA, badges) ·
  `--color-meadow: #eaf0e2` (soft fill) · `--color-clay-soft: #f6e8df`
- Fonts: `--font-display: "Fraunces", Georgia, serif` (Google Fonts, weights 400–700,
  optical sizing; CSP already allows fonts.googleapis.com/gstatic) for h1–h3 and stat
  numerals; system sans (`--font-sans`) for everything else.
- Shape: cards `rounded-xl` with 1px `line` border, **no drop shadows** (flat, printed
  feel); generous whitespace; kind-of-offer chips are small-caps sans badges with
  per-kind tints.
- Light theme only. No dark mode in v2.

Voice: warm, specific, school-inflected but never precious. Buttons say what happens
("Raise your hand", "Open this door", "Post it to the board"). Empty states teach the
loop. Admin UI is plainer and denser — staff are working, not browsing.

## Copy anchors

- Landing hero: **"The doors only Oysters can open."** Sub: "CRMS alumni and parents post
  internships, mentorships, and first jobs here that never reach a public job board —
  because this one is only for our school."
- Trust strip (landing): "Every adult here was approved by CRMS staff" · "Students make
  first contact, never the other way around" · "School staff can see every conversation".
- Student empty state (`/requests`): "You haven't raised your hand yet. Every offer on
  the board was posted for you specifically — pick one."
- Decline template (member, prefilled, editable): "Thanks for raising your hand — I've
  already filled this one, but I'm glad you went for it. Keep an eye on the board."

## Engineering ground rules

- Stack unchanged: React 19 + TS strict, Vite 7, React Router v7 (`createBrowserRouter`),
  Tailwind v4, Supabase JS v2, PWA via `vite-plugin-pwa` (generateSW; **no push, no custom
  sw.ts**). Deploy: push to `main` → Vercel.
- Data access: typed `supabase` client + `src/lib/database.types.ts` (generated). Small
  hand-rolled hooks (`useQuery`-style helpers in `src/lib/`), no new deps without reason.
- Components live in `src/components/ui/` (primitives: Button, Card, Badge, Field,
  Select, Textarea, Avatar, EmptyState, Spinner, Modal, Toast) and `src/components/`
  (app-level). Pages in `src/pages/{public,student,member,admin,shared}/`.
- Every mutation: optimistic-or-refetch, error toast with a human sentence, success toast
  only when navigation doesn't already confirm it.
- Tests: Vitest units for `src/lib/*`; Playwright e2e: unauthenticated shell + full loop
  smoke (`student raises hand → member accepts`) against seeded accounts.
- a11y: labels on every input, focus-visible rings (`pine`), semantic headings, WCAG AA
  contrast on all token pairs.
