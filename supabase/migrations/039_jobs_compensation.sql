-- 039_jobs_compensation.sql
--
-- P2-36 — optional compensation field on opportunities. Free text on
-- purpose: posters write things like "$22/hr", "Unpaid (school credit)",
-- "Stipend $1,500", or "Negotiable". Length-capped via the trigger from
-- migration 032 / CHECK constraint below.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS compensation TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_compensation_max_len') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_compensation_max_len
      CHECK (compensation IS NULL OR length(compensation) <= 200);
  END IF;
END $$;

-- Extend the sanitize trigger from migration 032 to clean compensation
-- on insert/update.
CREATE OR REPLACE FUNCTION public.jobs_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.title         := public.crms_clean_text(NEW.title);
  NEW.company       := public.crms_clean_text(NEW.company);
  NEW.location      := public.crms_clean_text(NEW.location);
  NEW.description   := public.crms_clean_text(NEW.description);
  IF NEW.how_to_apply IS NOT NULL  THEN NEW.how_to_apply  := public.crms_clean_text(NEW.how_to_apply);  END IF;
  IF NEW.contact_email IS NOT NULL THEN NEW.contact_email := public.crms_clean_text(NEW.contact_email); END IF;
  IF NEW.industry IS NOT NULL      THEN NEW.industry      := public.crms_clean_text(NEW.industry);      END IF;
  IF NEW.compensation IS NOT NULL  THEN NEW.compensation  := public.crms_clean_text(NEW.compensation);  END IF;
  RETURN NEW;
END;
$$;
