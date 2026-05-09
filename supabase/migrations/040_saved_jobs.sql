-- 040_saved_jobs.sql
--
-- P2-37 — bookmark / saved opportunities. A small composite-pk join
-- table; users can star an active opportunity and visit /saved to
-- review them later.

CREATE TABLE IF NOT EXISTS public.saved_jobs (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id     UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS saved_jobs_user_created_idx
  ON public.saved_jobs(user_id, created_at DESC);

ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_jobs_select_own ON public.saved_jobs;
CREATE POLICY saved_jobs_select_own ON public.saved_jobs
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS saved_jobs_insert_own ON public.saved_jobs;
CREATE POLICY saved_jobs_insert_own ON public.saved_jobs
  FOR INSERT WITH CHECK (user_id = auth.uid() AND public.is_active_or_admin());

DROP POLICY IF EXISTS saved_jobs_delete_own ON public.saved_jobs;
CREATE POLICY saved_jobs_delete_own ON public.saved_jobs
  FOR DELETE USING (user_id = auth.uid());
