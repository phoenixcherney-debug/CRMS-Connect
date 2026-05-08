-- 032_sanitize_user_text.sql
--
-- Audit task 2 — server-side sanitization for free-text user content.
--
-- Why this is server-side: the client uses Supabase from the browser. A
-- client-only sanitizer can be bypassed by hand-crafting a request. This
-- migration installs a Postgres function + per-table BEFORE INSERT/UPDATE
-- triggers so dangerous payloads can't land in the DB no matter which
-- client made the request.
--
-- Strategy:
--   1. crms_strip_html(text) — strips every <…>-shaped substring. We don't
--      allow any HTML in user content today, so this is a hard strip rather
--      than a DOMPurify-style allow-list.
--   2. crms_reject_sqli(text) — raises an exception when the payload looks
--      like a SQL-injection probe. Postgres parameterizes statements so
--      injection isn't possible against this DB, but the marker text
--      shouldn't reach the directory regardless (the audit caught
--      "<script>...</script> --DROP TABLE students;" rendered to other
--      users).
--   3. Per-table trigger that funnels relevant text columns through both.
--
-- Backfill at the end runs the strip-HTML pass over existing rows so the
-- pre-existing test payloads stop showing up.

-- Strip every <…>-shaped substring. Idempotent.
CREATE OR REPLACE FUNCTION public.crms_strip_html(t TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF t IS NULL THEN RETURN NULL; END IF;
  -- Greedy strip; the `g` flag in regexp_replace is the 4th arg.
  RETURN regexp_replace(t, '<[^>]*>', '', 'g');
END;
$$;

-- Raise on obvious SQL injection markers. The regex matches:
--   - `-- {drop|delete|update|alter|truncate|insert}` (a SQL comment used
--     to terminate a query and start a new one)
--   - `; {drop|delete|truncate} <something>`
--   - `union select`
-- Whitespace-tolerant, case-insensitive.
CREATE OR REPLACE FUNCTION public.crms_reject_sqli(t TEXT)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF t IS NULL THEN RETURN; END IF;
  IF t ~* '(--\s*\b(drop|delete|update|alter|truncate|insert)\b|;\s*\b(drop|delete|truncate)\b\s+\w|union\s+select)' THEN
    RAISE EXCEPTION 'crms: input rejected (sqli marker)' USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- Convenience: clean + reject in one call. Returns the cleaned text.
CREATE OR REPLACE FUNCTION public.crms_clean_text(t TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  PERFORM public.crms_reject_sqli(t);
  RETURN public.crms_strip_html(t);
END;
$$;

-- ─── Triggers per table ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.profiles_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bio IS NOT NULL                  THEN NEW.bio                  := public.crms_clean_text(NEW.bio); END IF;
  IF NEW.full_name IS NOT NULL            THEN NEW.full_name            := public.crms_clean_text(NEW.full_name); END IF;
  IF NEW.company IS NOT NULL              THEN NEW.company              := public.crms_clean_text(NEW.company); END IF;
  IF NEW.industry IS NOT NULL             THEN NEW.industry             := public.crms_clean_text(NEW.industry); END IF;
  IF NEW.mentor_type_other IS NOT NULL    THEN NEW.mentor_type_other    := public.crms_clean_text(NEW.mentor_type_other); END IF;
  IF NEW.student_seeking_other IS NOT NULL THEN NEW.student_seeking_other := public.crms_clean_text(NEW.student_seeking_other); END IF;
  IF NEW.interests_other IS NOT NULL      THEN NEW.interests_other      := public.crms_clean_text(NEW.interests_other); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_sanitize ON public.profiles;
CREATE TRIGGER profiles_sanitize BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_sanitize_trg();

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
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS jobs_sanitize ON public.jobs;
CREATE TRIGGER jobs_sanitize BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_sanitize_trg();

CREATE OR REPLACE FUNCTION public.student_posts_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.pitch := public.crms_clean_text(NEW.pitch);
  IF NEW.seeking_other IS NOT NULL THEN NEW.seeking_other := public.crms_clean_text(NEW.seeking_other); END IF;
  IF NEW.availability IS NOT NULL  THEN NEW.availability  := public.crms_clean_text(NEW.availability);  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS student_posts_sanitize ON public.student_posts;
CREATE TRIGGER student_posts_sanitize BEFORE INSERT OR UPDATE ON public.student_posts
  FOR EACH ROW EXECUTE FUNCTION public.student_posts_sanitize_trg();

CREATE OR REPLACE FUNCTION public.applications_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.cover_note := public.crms_clean_text(NEW.cover_note);
  IF NEW.resume_link IS NOT NULL THEN NEW.resume_link := public.crms_clean_text(NEW.resume_link); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS applications_sanitize ON public.applications;
CREATE TRIGGER applications_sanitize BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_sanitize_trg();

CREATE OR REPLACE FUNCTION public.messages_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.content := public.crms_clean_text(NEW.content);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS messages_sanitize ON public.messages;
CREATE TRIGGER messages_sanitize BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_sanitize_trg();

CREATE OR REPLACE FUNCTION public.events_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.title := public.crms_clean_text(NEW.title);
  IF NEW.description IS NOT NULL THEN NEW.description := public.crms_clean_text(NEW.description); END IF;
  IF NEW.location IS NOT NULL    THEN NEW.location    := public.crms_clean_text(NEW.location);    END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS events_sanitize ON public.events;
CREATE TRIGGER events_sanitize BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_sanitize_trg();

CREATE OR REPLACE FUNCTION public.meeting_requests_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.note IS NOT NULL THEN NEW.note := public.crms_clean_text(NEW.note); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS meeting_requests_sanitize ON public.meeting_requests;
CREATE TRIGGER meeting_requests_sanitize BEFORE INSERT OR UPDATE ON public.meeting_requests
  FOR EACH ROW EXECUTE FUNCTION public.meeting_requests_sanitize_trg();

CREATE OR REPLACE FUNCTION public.career_history_sanitize_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.company := public.crms_clean_text(NEW.company);
  NEW.title   := public.crms_clean_text(NEW.title);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS career_history_sanitize ON public.career_history;
CREATE TRIGGER career_history_sanitize BEFORE INSERT OR UPDATE ON public.career_history
  FOR EACH ROW EXECUTE FUNCTION public.career_history_sanitize_trg();

-- ─── Backfill ──────────────────────────────────────────────────────────────
-- Strip-HTML over existing rows. This deliberately uses crms_strip_html
-- (not crms_clean_text) so a row that historically contains a SQLi marker
-- doesn't blow up the migration — operators should review those rows
-- manually via the audit-fix-pass cleanup script (task 35).

UPDATE public.profiles SET
  bio                   = public.crms_strip_html(bio),
  full_name             = public.crms_strip_html(full_name),
  company               = public.crms_strip_html(company),
  industry              = public.crms_strip_html(industry),
  mentor_type_other     = public.crms_strip_html(mentor_type_other),
  student_seeking_other = public.crms_strip_html(student_seeking_other),
  interests_other       = public.crms_strip_html(interests_other);

UPDATE public.jobs SET
  title         = public.crms_strip_html(title),
  company       = public.crms_strip_html(company),
  location      = public.crms_strip_html(location),
  description   = public.crms_strip_html(description),
  how_to_apply  = public.crms_strip_html(how_to_apply),
  contact_email = public.crms_strip_html(contact_email),
  industry      = public.crms_strip_html(industry);

UPDATE public.student_posts SET
  pitch         = public.crms_strip_html(pitch),
  seeking_other = public.crms_strip_html(seeking_other),
  availability  = public.crms_strip_html(availability);

UPDATE public.applications SET
  cover_note  = public.crms_strip_html(cover_note),
  resume_link = public.crms_strip_html(resume_link);

UPDATE public.messages SET
  content = public.crms_strip_html(content);

UPDATE public.events SET
  title       = public.crms_strip_html(title),
  description = public.crms_strip_html(description),
  location    = public.crms_strip_html(location);

UPDATE public.meeting_requests SET
  note = public.crms_strip_html(note);

UPDATE public.career_history SET
  company = public.crms_strip_html(company),
  title   = public.crms_strip_html(title);
