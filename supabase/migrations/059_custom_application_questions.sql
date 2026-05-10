-- 059_custom_application_questions.sql
-- P1-7 — let employers ask up to three text questions on each posting,
-- and capture answers per application.
--
-- Stored as plain TEXT[] / JSONB so the existing row-level RLS already
-- governs access (the question list is readable by any authenticated
-- user via the existing jobs SELECT policy; the answers are inside
-- applications, where RLS already keeps them owner+poster only).

-- jobs.custom_questions — bounded list, ≤3, each ≤200 chars.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS custom_questions TEXT[] NOT NULL DEFAULT '{}';

-- Length cap is a CHECK; per-element shape validation lives in a trigger
-- below since CHECK constraints can't contain subqueries on Postgres.
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_custom_questions_max3;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_custom_questions_max3
    CHECK (array_length(custom_questions, 1) IS NULL OR array_length(custom_questions, 1) <= 3);

CREATE OR REPLACE FUNCTION public.jobs_validate_custom_questions_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE q TEXT;
BEGIN
  IF NEW.custom_questions IS NULL OR array_length(NEW.custom_questions, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  FOREACH q IN ARRAY NEW.custom_questions LOOP
    IF char_length(q) > 200 THEN
      RAISE EXCEPTION 'crms: custom question too long (max 200 chars)' USING ERRCODE = 'check_violation';
    END IF;
    IF length(btrim(q)) = 0 THEN
      RAISE EXCEPTION 'crms: custom question cannot be blank' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_validate_custom_questions ON public.jobs;
CREATE TRIGGER jobs_validate_custom_questions
  BEFORE INSERT OR UPDATE OF custom_questions ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_validate_custom_questions_trg();

-- applications.custom_answers — JSONB array of { question, answer }.
-- We snapshot the question text alongside the answer so a poster can
-- still edit / re-order their questions later without rewriting the
-- meaning of every existing applicant's submission.
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS custom_answers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS applications_custom_answers_shape;
ALTER TABLE public.applications
  ADD CONSTRAINT applications_custom_answers_shape
    CHECK (jsonb_typeof(custom_answers) = 'array');
