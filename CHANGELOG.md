# Changelog

## Unreleased — QA pass 6: P0 + P1 audit notes

- **H-05 — CAPTCHA + signup rate limit**: deferred. Cloudflare
  Turnstile (or hCaptcha) needs a provisioned site key + secret that
  has to be configured in the Supabase Dashboard (Auth → Providers
  → CAPTCHA Protection) before the client widget will work.
  Rate-limiting on `/auth/v1/signup` is already enforced by Supabase
  Auth at ~30/hour/IP — the brief's 5-per-15-minutes target is
  stricter and is also a Dashboard setting (Auth → Rate Limits).
  Both are operational config, not code.

## Unreleased — QA pass 5: P3 audit notes

- **P3-41 — signup rate limiting**: no code change needed. Supabase
  Auth enforces project-level rate limits on `/auth/v1/signup`
  (default ~30/hr per IP). The client also gates the submit button
  on a `submitting` flag, preventing rapid double-submits within a
  single tab.
- **P3-42 — email verification**: already shipped. `signUp` returns
  `needsVerification = !data.session`; Signup.tsx renders the "Check
  your inbox" success card on that branch, and the `validate-signup`
  Edge Function enforces server-side @crms.org domain rules and
  deletes the auth user if validation fails.
- **P3-45 — 'Other' role on signup**: deferred. The `role_type`
  Postgres enum is referenced by RLS policies on profiles, jobs,
  applications, conversations, events, etc. Adding a new role
  value (e.g. 'other') is a multi-migration change that needs
  product-side decisions about what such users can see / post /
  message. Holding until those decisions land. The DB enum already
  carries `alumni` and `parent` values that are not exposed in the
  signup UI — those would be the natural first targets if we wanted
  to widen signup without inventing a new role.
- **P3-54 — light / dark theme audit**: there is no dark theme to
  audit. The app ships a single light palette via CSS custom
  properties in `src/index.css` (no `prefers-color-scheme` block,
  no Tailwind `dark:` variants, no theme toggle). Building one is
  feature work, not an audit fix; deferring until a real design
  decision is made.

## Unreleased — QA pass: black-box backlog (BLOCKER + HIGH + MEDIUM + LOW)

Second QA pass against the deployed app. Each commit on this branch
maps to a single audit ID; this entry summarizes the round.

### BLOCKER

- **B1** — /profile crash (React #310). Root cause: `useState` and
  `useEffect` for `avatarBroken` lived **below** an early return, so on
  the second render the hook order changed. Hoisted them to the top of
  the component. Added `RootErrorBoundary` inside `Layout` so a future
  page-level render error shows a recoverable fallback while keeping
  header + footer visible. `react-hooks/rules-of-hooks` is at `error`
  in our flat config (no regression to land in the future). Fixed in
  commit `f572e7a`.
- **B2** — display-name moderation + admin-review queue: explicitly
  skipped this session per direction. Email verification (Supabase
  Auth) and server-side @crms.org domain check (the existing
  `validate-signup` Edge Function) are already shipped — re-verified.

### HIGH

- **HIGH-3** — test/joke content sweep: operational, not code. The
  team has DB access; no commit here.
- **HIGH-4** — /onboarding redirects already-onboarded users to
  /explore via `<Navigate>` instead of rendering the empty Welcome
  form a second time. Commit `0fb5379`.
- **HIGH-5** — date validation on /jobs/new now shows per-field
  inline errors with `aria-invalid` + `aria-describedby`, plus a
  `scrollIntoView` on the top error banner so the feedback is visible
  from the bottom of a long form. Past-deadline guard fires on create
  only (don't block edits to already-past postings). Commit `50494ba`.
- **HIGH-6** — resolved by B1. There were no stray `Profile` imports
  outside the lazy route; the React #310 trace just happened to be
  sourced from the Profile chunk because that's where the buggy code
  lived.
- **HIGH-7** — resume / portfolio link hardening. Added
  `src/lib/url.ts` with an allowlist `validateExternalUrl` that
  rejects `javascript:`, `data:`, `vbscript:`, `file:`, and anything
  the WHATWG parser refuses. Wired into the apply submit and into all
  three render sites (JobDetail confirmation panel, MyApplications,
  Applicants). 7 unit tests in `url.test.ts`. Commit `9a2155e`.
- **HIGH-8** — student onboarding now collects `weekly_availability`,
  closing the loop where Applicants always read "not set" because the
  only place to fill the field was /profile (B1). Commit `ce5e34c`.

### MEDIUM

- **M1 + M7 + M11** — split /people into `/students` and `/mentors`.
  `<People />` now takes a `directory` prop; filter logic is keyed off
  `targetRole` instead of viewer role so /students works the same
  whether the viewer is an EM or another student. /people redirects
  by viewer role. Same-role privacy guard in PublicProfile is lifted
  for student↔student viewing only. /meetings empty-state link, the
  /explore quick-action cards, and PublicProfile back-links all updated
  to point at the role-specific destination. Commit `9859d14`.
- **M2** — vocabulary alignment: /employers H1 → "Employers & Mentors"
  (was "Companies"); /availability menu / H1 / tab title →
  "Availability" (was "My Calendar"). Commit `05b89a6`.
- **M3** — empty-form submits no longer no-op silently. /onboarding
  routes specific reasons into the existing saveError banner and
  scrolls the offending section into view. Apply form's disabled
  Submit button gets `aria-disabled` + tooltip + sr-only status so
  keyboard / SR users learn what's missing. Commit `b445106`.
- **M4** — Accept and Decline on /jobs/:id/applicants now require a
  second click ("Yes, accept" / "Yes, decline" + Cancel). The Decided
  tab gets a "Reverse decision" affordance with the same pattern.
  Commit `7e0ed3b`.
- **M5** — Company / Organization is required for all employer/mentor
  accounts in onboarding (was optional for "mentor" / "other" sub-
  roles) and on /profile edit (was always optional). Existing rows
  without a company keep working; the guard only fires on save.
  Commit `7e04bb0`.
- **M6** — real catch-all 404 route. Renders inside Layout so
  navigation chrome stays. Commit `a2ffec2`.
- **M8** — content moderation: skipped per direction.
- **M9** — student grade is now opt-in. Migration 031 adds
  `profiles.share_grade_with_employers` (default false). /profile
  shows a "Share my grade with employers and mentors" checkbox.
  /students, /jobs/:id/applicants, /people/:id, /postings all check
  the flag before rendering grade. Privacy doc on /privacy rewritten
  with a per-field audience breakdown. Commit `b7a8655`.
- **M10** — student "looking for" posts wired into /feed for EM
  viewers. New 'student_post' FeedItem kind. Closed posts excluded.
  Commit `33f5043`.

### LOW (polish batch — commit `51072e8`)

- **F-001 / F-007** — greeting on /explore trims + title-cases the
  first name (render-only).
- **F-003** — aria-label + aria-pressed on the show/hide-password
  buttons in Login + Signup.
- **F-013 / F-014** — aria-pressed on /jobs filter chips; the two All
  buttons distinguished by aria-label.
- **F-015** — added "Oldest first" and "Title A–Z" to the /jobs sort
  dropdown.
- **F-018** — `Message {firstName}` falls back to "Message poster" /
  "Message this person" when full_name is empty after trim.
- **F-040** — /meetings auto-polls every 30s; Refresh button removed.
- **F-051** — already-signed-in /login + /signup redirect to /explore,
  not /jobs.
- **F-065** — aria-label distinguishes Close (reversible, stop
  accepting) from Delete (permanent) on /my-postings.

Skipped: F-002 (Forgot password URL — kept as in-Login state toggle),
F-016 (job-detail prefetch / skeleton), F-025 (mentor card hover bio),
F-037 (calendar view-mode names) — minor enough for a separate pass.

### CI hardening

- Added `e2e/fixtures.ts` — a custom Playwright `test` fixture that
  fails any test if the page emits a `console.error` or unhandled
  `pageerror`. The exact safety net that would have caught B1.
- Added `e2e/console-clean.spec.ts` — visits /login, /signup, /about,
  /privacy, and a 404 path under the trap. No auth required, safe to
  run on any preview.
- `react-hooks/rules-of-hooks` is at error in the existing flat
  config (no change needed).

### Out of scope this session

- Schema test for `users.onboarding_completed_at` etc. (heavier infra).
- Visual regression (Chromatic / Percy / Playwright snapshots).
- Email-verification + admin-review queue + display-name moderation
  (B2 sub-parts, deferred per direction).

---

## Earlier — QA pass: 25 fixes

Black-box QA backlog covered in a single pass. Each item is keyed back to
the issue # in the brief that landed for this pass.

### High-priority

- **#1** Sign out clears auth state synchronously and pushes to `/login` with
  `replace: true`, so the previous user's name/avatar/data leave the DOM
  immediately instead of waiting for Supabase's `onAuthStateChange` event.
- **#2** `/jobs/:id/applicants` now authorizes against the job's `posted_by`
  before fetching the applicant list. Non-owner (and non-admin) viewers get
  a "Page not found" view rather than the inbox chrome with an empty list.
  Playwright coverage added in `e2e/auth.spec.ts`.
- **#3** `/about` and `/privacy` are wrapped in the shared `Layout` so the
  green CRMS Connect header and footer render whether logged in or not. Nav
  shows Sign in / Create an account links to unauthenticated visitors.
- **#4** Added a permanent redirect from `/applications` → `/my-applications`
  (Vercel `308` + an in-router `Navigate` for client-side hits).
- **#5** Parallelized the `/people/:id` profile / career history / availability
  fetches with `Promise.all` to remove the 2–3s loading spinner. Removed the
  "Stuck on a loading screen? Reset the app" link from `/login` now that the
  underlying issue is gone.

### Medium-priority

- **#6** `/people` student view now reads "Mentors" and `/employers` reads
  "Companies", so each route has a unique H1.
- **#7** Reconciled menu / heading / tab title vocabulary: Applications,
  Inbox, My Calendar, Activity, Student Posts. The dashboard "Browse Feed"
  card is now "Activity".
- **#8** `/people/:id` sets `document.title` to the person's name when the
  profile loads, e.g. "Eve Employer · CRMS Connect".
- **#9** Tightened the student "Expected graduation year" range to
  `[currentYear − 1, currentYear + 8]` in onboarding and self-edit. Alumni
  in EM accounts keep the wider DB-backed range.
- **#10** `/jobs` cards now line-clamp to two lines via CSS instead of the
  one-line clamp that was chopping titles like "Junior Software…".
- **#11** Verified Interests requiredness is consistent (required at
  onboarding, optional on My Posts) — matches the recommended split.
- **#12** Application confirmation panel on `/jobs/:id` now shows the cover
  note alongside Interests, Grade, Availability, and Resume.
- **#13** Split the `/jobs` filter chips into a labeled "Type" group
  (Internship / Part-Time / Full-Time / Volunteer / Mentorship / Job Shadow
  / Other / All) and a separate labeled "Location" group (Remote / In-Person
  / Hybrid / All). Type group now covers every category from the post form.
- **#14** Activity feed copy now reads `{name} posted a {category} opportunity`
  using the canonical `JOB_TYPE_LABELS`. Removed the `opportunity_type`
  branch that produced "posted a job / internship opportunity".
- **#15** Onboarding "Complete setup" now redirects everyone (students and
  employer/mentors) to `/explore` so users land on the welcome dashboard
  before being dropped into Jobs.
- **#16** Updated `/about` and `/events` empty-state copy to drop "alumni"
  and "parents" references that didn't correspond to any signup option.

### Low-priority polish

- **#17** Fixed `/employers` typo: `companys` → `companies`.
- **#18** Renamed the `student_seeking` "Other" label to "Something else"
  so it doesn't visually collide with the "Other" chip in the same form's
  Areas of Interest list.
- **#19** Trash icon on `/my-posts` now has a visible "Delete" label and an
  `aria-label="Delete post"`. The existing delete-confirmation modal stays.
- **#20** `/people` cards now equalize via grid `align-items: stretch` plus a
  `flex-1` spacer; the Message button anchors to the bottom of every card.
- **#21** Onboarding shows an inline "Employers must specify a company name."
  note under the role buttons when the requirement kicks in, so the silent
  asterisk swap on the Company field is no longer a mystery.
- **#22** Notifications page lost the manual Refresh button; the existing
  Supabase Realtime subscription on `messages` and `applications` already
  keeps the page live, so the button was redundant.
- **#23** "What was shared with the poster" panel hides the Resume / Portfolio
  row entirely when no link was provided, instead of showing "Not provided".
- **#24** Renamed the applicant card's availability label to "Profile
  availability" so it's clear the value comes from the student's profile,
  not from a specific student post.
- **#25** Added an in-app "Delete account" affordance under `/profile`. Soft-
  delete: anonymizes personal fields and sets `banned_at` (covered by RLS
  030) so the account is hidden from listings and bounces to `/banned` on
  any future sign-in. Confirmation modal requires the user to type their
  email; opens a registrar mailto for audit until an Edge Function is wired
  up for that side.

### Tests

- Added `e2e/auth.spec.ts` with Playwright coverage for #1 (sign-out clears
  the DOM and lands on `/login`) and #2 (cross-employer applicants 404).
- Updated `e2e/smoke.spec.ts` student onboarding assertion to expect
  `/explore` instead of `/jobs` (see #15).

### Out of scope (handled separately)

- User-display-name moderation / profanity filtering.
- "School review" gate on employer/mentor accounts before they can message
  students.
- Cleaning up inappropriate seed data.
- Real `@crms.org` email verification.
