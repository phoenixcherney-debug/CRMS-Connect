-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025: Widen jobs SELECT policy
--
-- Migration 021 restricted employer_mentor reads on `jobs` to their own posts:
--   USING (auth.uid() = posted_by OR (...) = 'student')
-- That was the wrong default for a community job board:
--   * The Activity feed for employers was empty (audit Â§6).
--   * The Explore stat counters showed 0 Opportunities / 0 Companies for an
--     employer with no posts (audit Â§10), even though the community had jobs.
-- Both roles should be able to read every active job. The /my-postings page
-- already filters to posted_by = auth.uid() in the client; access control on
-- mutations (insert/update/delete) remains unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "jobs_select_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_authenticated"
  ON public.jobs
  FOR SELECT
  TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
