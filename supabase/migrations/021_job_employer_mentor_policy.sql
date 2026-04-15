-- Migration 021: Fix jobs INSERT/SELECT policies for employer_mentor role
-- Migration 019 moved all alumni/parent users to employer_mentor, but the
-- INSERT policy still checked for 'alumni'/'parent' roles. This replaces
-- both the INSERT and SELECT policies to match the new role model.

-- ── Jobs SELECT: employer_mentor sees own posts only; students see all ──────
DROP POLICY IF EXISTS "jobs_select_authenticated" ON jobs;
CREATE POLICY "jobs_select_authenticated" ON jobs FOR SELECT TO authenticated USING (
  auth.uid() = posted_by
  OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'student'
);

-- ── Jobs INSERT: employer_mentor only ────────────────────────────────────────
DROP POLICY IF EXISTS "jobs_insert_alumni_parent"  ON jobs;
DROP POLICY IF EXISTS "jobs_insert_employer_mentor" ON jobs;
CREATE POLICY "jobs_insert_employer_mentor" ON jobs FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = posted_by
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'employer_mentor'
);

-- ── Events INSERT: employer_mentor only ──────────────────────────────────────
DROP POLICY IF EXISTS "events_insert_alumni_parent"   ON events;
DROP POLICY IF EXISTS "events_insert_employer_mentor" ON events;
CREATE POLICY "events_insert_employer_mentor" ON events FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = host_id
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'employer_mentor'
);

NOTIFY pgrst, 'reload schema';
