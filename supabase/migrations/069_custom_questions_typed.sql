-- 069_custom_questions_typed.sql
-- Phase 3.6 — expand custom application questions from a flat TEXT[]
-- to typed records, and raise the cap from 3 to 5. Each entry is now
--   { text: string; type: 'short_text' | 'long_text' | 'single_select';
--     required: bool; options?: string[] }
--
-- Existing rows are migrated 1:1 to short_text + not required so
-- already-published posts continue to render their original prompts.

-- 1) Add a new JSONB column.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS custom_questions_v2 JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2) Backfill from the legacy TEXT[] column.
UPDATE public.jobs
   SET custom_questions_v2 = COALESCE(
     (SELECT jsonb_agg(jsonb_build_object(
        'text', q,
        'type', 'short_text',
        'required', TRUE
      )) FROM unnest(custom_questions) AS q WHERE length(btrim(q)) > 0),
     '[]'::jsonb
   )
 WHERE custom_questions IS NOT NULL
   AND array_length(custom_questions, 1) IS NOT NULL
   AND jsonb_array_length(custom_questions_v2) = 0;

-- 3) Drop the old TEXT[] constraints + trigger; we keep the column around
--    for a single deploy cycle in case the client is mid-rollout, but new
--    writes go through the JSONB column. (A later migration can drop it.)
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_custom_questions_max3;
DROP TRIGGER IF EXISTS jobs_validate_custom_questions ON public.jobs;

-- 4) Constraints on the new column.
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_custom_questions_v2_shape;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_custom_questions_v2_shape
    CHECK (
      jsonb_typeof(custom_questions_v2) = 'array'
      AND jsonb_array_length(custom_questions_v2) <= 5
    );

-- 5) Per-element validation lives in a trigger (CHECK can't iterate JSONB).
CREATE OR REPLACE FUNCTION public.jobs_validate_custom_questions_v2_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  q JSONB;
  q_type TEXT;
  opt JSONB;
  opt_text TEXT;
BEGIN
  IF NEW.custom_questions_v2 IS NULL OR jsonb_array_length(NEW.custom_questions_v2) = 0 THEN
    RETURN NEW;
  END IF;
  FOR q IN SELECT * FROM jsonb_array_elements(NEW.custom_questions_v2) LOOP
    IF coalesce(q->>'text', '') = '' OR char_length(q->>'text') > 200 THEN
      RAISE EXCEPTION 'crms: custom question text must be 1-200 chars' USING ERRCODE = 'check_violation';
    END IF;
    q_type := coalesce(q->>'type', '');
    IF q_type NOT IN ('short_text', 'long_text', 'single_select') THEN
      RAISE EXCEPTION 'crms: custom question type must be short_text / long_text / single_select' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT (q ? 'required') OR jsonb_typeof(q->'required') <> 'boolean' THEN
      RAISE EXCEPTION 'crms: custom question required flag missing' USING ERRCODE = 'check_violation';
    END IF;
    IF q_type = 'single_select' THEN
      IF jsonb_typeof(q->'options') <> 'array' OR jsonb_array_length(q->'options') < 2 OR jsonb_array_length(q->'options') > 8 THEN
        RAISE EXCEPTION 'crms: single_select needs 2-8 options' USING ERRCODE = 'check_violation';
      END IF;
      FOR opt IN SELECT * FROM jsonb_array_elements(q->'options') LOOP
        IF jsonb_typeof(opt) <> 'string' THEN
          RAISE EXCEPTION 'crms: option must be a string' USING ERRCODE = 'check_violation';
        END IF;
        opt_text := opt #>> '{}';
        IF char_length(opt_text) = 0 OR char_length(opt_text) > 80 THEN
          RAISE EXCEPTION 'crms: option must be 1-80 chars' USING ERRCODE = 'check_violation';
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_validate_custom_questions_v2 ON public.jobs;
CREATE TRIGGER jobs_validate_custom_questions_v2
  BEFORE INSERT OR UPDATE OF custom_questions_v2 ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_validate_custom_questions_v2_trg();
