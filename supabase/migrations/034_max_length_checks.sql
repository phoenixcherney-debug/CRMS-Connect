-- 034_max_length_checks.sql
--
-- SEC-002 — server-side max-length enforcement on free-text fields. The
-- client maxLength attribute is for UX only; a hand-crafted request can
-- bypass it. CHECK constraints make the DB the source of truth.
--
-- Limits per audit spec:
--   bio:               2000
--   description:       4000  (jobs + events)
--   cover_note:        2000
--   student_post.pitch:1000
--   messages.content:  4000
--   full_name:         80
--   company:           120  (jobs.company AND profiles.company)

-- Helper: idempotent ADD CONSTRAINT pattern.
DO $$
BEGIN
  -- profiles
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_bio_max_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_max_len
      CHECK (bio IS NULL OR length(bio) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_full_name_max_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_max_len
      CHECK (length(full_name) <= 80);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_company_max_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_max_len
      CHECK (company IS NULL OR length(company) <= 120);
  END IF;

  -- jobs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_description_max_len') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_description_max_len
      CHECK (length(description) <= 4000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_company_max_len') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_company_max_len
      CHECK (length(company) <= 120);
  END IF;

  -- applications
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_cover_note_max_len') THEN
    ALTER TABLE public.applications ADD CONSTRAINT applications_cover_note_max_len
      CHECK (length(cover_note) <= 2000);
  END IF;

  -- student_posts
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_posts_pitch_max_len') THEN
    ALTER TABLE public.student_posts ADD CONSTRAINT student_posts_pitch_max_len
      CHECK (length(pitch) <= 1000);
  END IF;

  -- messages
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_max_len') THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_content_max_len
      CHECK (length(content) <= 4000);
  END IF;

  -- events
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_description_max_len') THEN
    ALTER TABLE public.events ADD CONSTRAINT events_description_max_len
      CHECK (description IS NULL OR length(description) <= 4000);
  END IF;
END $$;
