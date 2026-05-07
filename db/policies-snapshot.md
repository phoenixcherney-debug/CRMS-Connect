# RLS policies snapshot

**Schema:** `public`
**Last reconstructed from migrations:** 2026-05-06 (migrations 001 → 029)

This file is the source-of-truth document for what RLS *should* look like on the
production database. The auditor's brief asks us to commit this so future
audits can diff against it instead of reading every migration.

The expected table below is hand-built from the migration history. To verify
that the **live database** matches it, run the query at the bottom of this
file in the Supabase SQL editor and paste the output into the "Live snapshot"
section. Any drift between expected and live is something to investigate.

---

## Expected policies

### `profiles`

| Policy | Cmd | Roles | Using | With check | Source |
|---|---|---|---|---|---|
| `profiles_select_authenticated` | `SELECT` | `authenticated` | `banned_at IS NULL OR id = auth.uid() OR is_admin()` | — | 023 |
| `profiles_update_own` | `UPDATE` | `authenticated` | `auth.uid() = id` | `auth.uid() = id` | 001 |
| `profiles_insert_trigger` | `INSERT` | `authenticated` | — | `auth.uid() = id` | 001 |
| `Users can update own profile` | `UPDATE` | `authenticated` | `auth.uid() = id` | `auth.uid() = id` | 020 |

**Audit notes:**
- `profiles` does not store an `email` column on this schema — emails live on
  `auth.users` and are surfaced only through the `admin_list_users()` RPC
  which is gated by `is_admin()`. So the brief's concern about students seeing
  other students' emails is structurally addressed.
- Banned profiles are hidden from non-admins (added in migration 023 as part
  of the audit-pass-1 fixes).

### `jobs`

| Policy | Cmd | Roles | Using | With check | Source |
|---|---|---|---|---|---|
| `jobs_select_authenticated` | `SELECT` | `authenticated` | `true` | — | 025 |
| `jobs_insert_employer_mentor` | `INSERT` | `authenticated` | — | `auth.uid() = posted_by AND role = 'employer_mentor'` | 021 |
| `jobs_update_own` | `UPDATE` | `authenticated` | `auth.uid() = posted_by` | `auth.uid() = posted_by` | 001 |
| `jobs_delete_own` | `DELETE` | `authenticated` | `auth.uid() = posted_by` | — | 001 |

**Audit notes:**
- Migration 025 widened SELECT from "own posts only" to all-authenticated so
  employers see community jobs in Activity / Explore. Side effect: any
  authenticated user can read every column of every job, including
  `contact_email`. Mitigation: a column-restricted view `public.jobs_public`
  exists from migration 023 (excludes `contact_email`); the
  `public.job_contact_email(uuid)` SECURITY DEFINER function returns the email
  only to the poster, an admin, or an applicant whose application has been
  accepted.
- **Known gap:** the client still does `select('*')` from `jobs` in several
  places, so `contact_email` is reachable. The follow-up is migrating every
  read path to `jobs_public`, then revoking column-level SELECT on
  `jobs.contact_email` from `authenticated` (sketched in migration 028's
  comment block).
- Migration 027 enforces non-blank `title`, `company`, `location`,
  `description` via CHECK constraints.

### `applications`

| Policy | Cmd | Roles | Using | With check | Source |
|---|---|---|---|---|---|
| `applications_select` | `SELECT` | `authenticated` | `applicant_id = auth.uid() OR posted_by(job_id) = auth.uid()` | — | 001 |
| `applications_insert_own` | `INSERT` | `authenticated` | — | `auth.uid() = applicant_id` | 001 |
| `applications_update_status` | `UPDATE` | `authenticated` | `posted_by(job_id) = auth.uid()` | — | 001 |

**Audit notes:**
- Students see only their own; employers see only those for jobs they posted.
- Migration 024 dropped the orphan `trigger_update_job_applicant_count`
  trigger that was failing every insert with a missing-column error.

### `conversations`

| Policy | Cmd | Roles | Using | With check | Source |
|---|---|---|---|---|---|
| `conversations_select_participant` | `SELECT` | `authenticated` | `auth.uid() IN (participant_one, participant_two)` | — | 001 |
| `conversations_insert` | `INSERT` | `authenticated` | — | `auth.uid() IN (participant_one, participant_two)` | 001 |

### `messages`

| Policy | Cmd | Roles | Using | With check | Source |
|---|---|---|---|---|---|
| `messages_select_participant` | `SELECT` | `authenticated` | conversation participant | — | 001 |
| `messages_insert_participant` | `INSERT` | `authenticated` | — | sender = auth.uid() AND conversation participant | 001 |
| `messages_update_read` | `UPDATE` | `authenticated` | conversation participant | — | 001 |

### Other tables

`events`, `student_posts`, `availability_slots`, `meeting_requests`,
`push_subscriptions`, `notifications` (if present) — confirm policies during
the live verification step below.

---

## Live verification — paste output here

Run this in the Supabase SQL editor:

```sql
SELECT schemaname, tablename, policyname, cmd, permissive, roles,
       qual::text       AS using_expression,
       with_check::text AS with_check_expression
  FROM pg_policies
 WHERE schemaname = 'public'
 ORDER BY tablename, policyname;
```

Plus, to verify RLS is *enabled* on each table:

```sql
SELECT relname AS tablename, relrowsecurity AS rls_enabled
  FROM pg_class
 WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
 ORDER BY relname;
```

Migration 028 also dumps the same information via NOTICE; either path works.

### Live output (paste below, dated)

> _Paste the output of the queries above the next time the production DB is
> snapshotted. Until then, the **expected** table above is what the policies
> should look like._

```
-- (run the SQL and paste here)
```

---

## Black-box verification

After running the queries above:

- `select * from jobs` against the **anon** role should fail or return zero
  rows (no anon read policy on `jobs`). Verify with:
  ```bash
  curl -s "https://<your-project>.supabase.co/rest/v1/jobs?select=*" \
       -H "apikey: <anon-key>" -H "Authorization: Bearer <anon-key>"
  ```
  Expect `[]` or a 401-ish response.

- `select contact_email from jobs` as an authenticated *non-poster* should
  return the column today (known gap). After the planned column-level revoke,
  it should return "permission denied for column contact_email".

- Any new table added to `public` should be added to the table above before
  this snapshot is reused.
