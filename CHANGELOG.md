# Changelog

## Unreleased — QA pass: 25 fixes

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
