-- 070_mentor_wall.sql
-- Phase 4.3 — opt-in public Mentor Wall on /about. Mentors who flip the
-- toggle appear on the public landing page (visible to anonymous
-- visitors). The wall surface is read-only and never exposes email,
-- bio, or grade — just name, avatar, company/industry, mentor type.
--
-- Implemented as a SECURITY DEFINER function rather than a broad anon
-- SELECT policy on profiles, so the public surface stays tightly scoped
-- to safe columns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_on_mentor_wall BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.list_mentor_wall()
RETURNS TABLE (
  id           UUID,
  full_name    TEXT,
  avatar_url   TEXT,
  company      TEXT,
  industry     TEXT,
  mentor_type  TEXT,
  mentor_type_other TEXT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, full_name, avatar_url, company, industry, mentor_type::text, mentor_type_other
    FROM public.profiles
   WHERE role = 'employer_mentor'
     AND show_on_mentor_wall = TRUE
     AND coalesce(banned_at, 'epoch'::timestamptz) <= 'epoch'::timestamptz
   ORDER BY created_at DESC
   LIMIT 60;
$$;

REVOKE ALL ON FUNCTION public.list_mentor_wall() FROM public;
GRANT EXECUTE ON FUNCTION public.list_mentor_wall() TO anon, authenticated;
