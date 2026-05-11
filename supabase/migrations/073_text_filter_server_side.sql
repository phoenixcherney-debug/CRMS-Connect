-- 073_text_filter_server_side.sql
-- Task 1 — server-side mirror of lib/textFilter.ts. The client check
-- catches the common case; this trigger backs it up so a curl bypass
-- can't slip the same content past the form. Patterns are kept short
-- on purpose — the goal is to stop the obvious payloads, not be an
-- exhaustive deny-list. The registrar still reviews /admin/reports.
--
-- Implemented as one function `public.text_has_blocked_terms(text)`
-- that returns true if the input contains a blocked term. Per-table
-- BEFORE INSERT/UPDATE triggers raise check_violation when it does.

CREATE OR REPLACE FUNCTION public.text_has_blocked_terms(input TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  flat  TEXT;
  pat   TEXT;
  pats  TEXT[] := ARRAY[
    -- Slurs — character classes match basic leet substitutions.
    '[n][i1!][g][g3][3e][r]',
    '[n][i1!][g][g3][3e][a4@]',
    '[f][a4@][g][g][o0][t7]',
    '[r][3e][t7][a4@][r][d]',
    '[t7][r][a4@][n][n][y]',
    '[k][i1!][k][3e]',
    '[s$5][p][i1!][c]',
    '[c][h][i1!][n][k]',
    '[g][o0][o0][k]',
    '[w][3e][t7][b][a4@][c][k]',
    '[c][o0][o0][n]',
    '[c][u][n][t7]',
    -- Sexual / grooming-adjacent.
    '[p][3e][d][o0]',
    '[r][a4@][p][i1!][s$5][t7]',
    '[m][o0][l][3e][s$5][t7][3e][r]',
    'likeslittleboys',
    'likeslittlegirls',
    'lickslittleboys',
    'lickslittlegirls'
  ];
BEGIN
  IF input IS NULL OR length(input) = 0 THEN
    RETURN FALSE;
  END IF;
  -- Normalize: lowercase, strip whitespace + non-alphanumerics (except $, @, !).
  flat := regexp_replace(lower(input), '[^a-z0-9$@!]+', '', 'g');
  IF flat = '' THEN RETURN FALSE; END IF;
  FOREACH pat IN ARRAY pats LOOP
    IF flat ~ pat THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  RETURN FALSE;
END;
$$;

-- Reuse the existing profile sanitize trigger pattern; add bio check.
CREATE OR REPLACE FUNCTION public.profiles_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.full_name) THEN
    RAISE EXCEPTION 'crms: blocked term in name'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:name';
  END IF;
  IF public.text_has_blocked_terms(NEW.bio) THEN
    RAISE EXCEPTION 'crms: blocked term in bio'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:bio';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_check_text_filter ON public.profiles;
CREATE TRIGGER profiles_check_text_filter
  BEFORE INSERT OR UPDATE OF full_name, bio ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_check_text_filter_trg();

-- Opportunities — title + description + how_to_apply.
CREATE OR REPLACE FUNCTION public.jobs_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.title)
     OR public.text_has_blocked_terms(NEW.description)
     OR public.text_has_blocked_terms(NEW.how_to_apply)
     OR public.text_has_blocked_terms(NEW.company) THEN
    RAISE EXCEPTION 'crms: blocked term in opportunity text'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:opportunity';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_check_text_filter ON public.jobs;
CREATE TRIGGER jobs_check_text_filter
  BEFORE INSERT OR UPDATE OF title, description, how_to_apply, company ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_check_text_filter_trg();

-- Student posts — pitch text.
CREATE OR REPLACE FUNCTION public.student_posts_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.pitch) THEN
    RAISE EXCEPTION 'crms: blocked term in student post'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:student_post';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_posts_check_text_filter ON public.student_posts;
CREATE TRIGGER student_posts_check_text_filter
  BEFORE INSERT OR UPDATE OF pitch ON public.student_posts
  FOR EACH ROW EXECUTE FUNCTION public.student_posts_check_text_filter_trg();

-- Messages — body content.
CREATE OR REPLACE FUNCTION public.messages_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.content) THEN
    RAISE EXCEPTION 'crms: blocked term in message'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:message';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_check_text_filter ON public.messages;
CREATE TRIGGER messages_check_text_filter
  BEFORE INSERT OR UPDATE OF content ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_check_text_filter_trg();

-- Applications — cover note + custom answers (jsonb scanned by stringify).
CREATE OR REPLACE FUNCTION public.applications_check_text_filter_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF public.text_has_blocked_terms(NEW.cover_note) THEN
    RAISE EXCEPTION 'crms: blocked term in cover note'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:application';
  END IF;
  IF NEW.custom_answers IS NOT NULL
     AND public.text_has_blocked_terms(NEW.custom_answers::text) THEN
    RAISE EXCEPTION 'crms: blocked term in custom answers'
      USING ERRCODE = 'check_violation', HINT = 'blocked_term:application';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS applications_check_text_filter ON public.applications;
CREATE TRIGGER applications_check_text_filter
  BEFORE INSERT OR UPDATE OF cover_note, custom_answers ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_check_text_filter_trg();
