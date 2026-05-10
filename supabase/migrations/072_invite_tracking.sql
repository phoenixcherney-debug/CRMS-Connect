-- 072_invite_tracking.sql
-- Phase 4.6 — track who invited whom. InviteMentorButton already shares
-- a link with `?from=<id>`; this lets us attribute new signups to the
-- inviter so they can see "X invited, Y joined."

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- No-self-invite guard.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_invited_by_not_self;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_invited_by_not_self
    CHECK (invited_by_user_id IS NULL OR invited_by_user_id <> id);

-- Index for the inviter's count lookup.
CREATE INDEX IF NOT EXISTS profiles_invited_by_idx
  ON public.profiles (invited_by_user_id)
  WHERE invited_by_user_id IS NOT NULL;
