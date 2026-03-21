-- Pinned jobs: users can pin any job to the top of their feed
CREATE TABLE IF NOT EXISTS pinned_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

ALTER TABLE pinned_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own pins
CREATE POLICY "Users can view own pins"
  ON pinned_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can pin jobs"
  ON pinned_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unpin jobs"
  ON pinned_jobs FOR DELETE
  USING (auth.uid() = user_id);
