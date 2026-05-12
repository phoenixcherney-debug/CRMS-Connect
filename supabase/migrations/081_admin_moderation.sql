-- 081_admin_moderation.sql
-- Admin moderation pass. Three responsibilities:
--   1) Tighten the security boundary so a non-admin client can never
--      grant themselves admin (signup metadata, profile update).
--   2) Widen admin's read access to messages + conversations.
--   3) Add admin promote/demote/soft-delete RPCs with last-admin
--      safeguards.
--
-- The is_admin() SECURITY DEFINER function from migration 029 is the
-- single source of truth; it reads from profiles.role, not from the
-- JWT alone. All new RPCs gate on it.

-- ── 1. handle_new_user: never trust 'admin' from signup metadata ──
-- The default in migration 079 took the role straight from the
-- user_metadata payload. A malicious signup client could just send
-- `role: 'admin'`. Coerce 'admin' (or any unknown value) to 'student'
-- here; the only path to admin is via admin_set_user_role() below.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  inviter UUID;
  pref    TEXT;
  claimed TEXT;
  resolved public.role_type;
BEGIN
  BEGIN
    inviter := (NEW.raw_user_meta_data->>'invited_by')::uuid;
    IF inviter = NEW.id THEN inviter := NULL; END IF;
  EXCEPTION WHEN OTHERS THEN
    inviter := NULL;
  END;

  pref := NULLIF(btrim(NEW.raw_user_meta_data->>'preferred_name'), '');
  IF pref IS NOT NULL AND char_length(pref) > 40 THEN
    pref := substr(pref, 1, 40);
  END IF;

  claimed := NEW.raw_user_meta_data->>'role';
  -- Only the public-facing roles are accepted at signup. Anything else
  -- — including 'admin' — falls back to 'student' so the account
  -- creates cleanly but never holds elevated privileges.
  resolved := CASE
    WHEN claimed IN ('student', 'employer_mentor') THEN claimed::public.role_type
    ELSE 'student'::public.role_type
  END;

  INSERT INTO public.profiles (id, full_name, role, invited_by_user_id, preferred_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    resolved,
    inviter,
    pref
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

-- ── 2. profile role changes are admin-only ───────────────────────
-- The existing profiles_update_own_or_admin policy lets a user UPDATE
-- their own row. That includes the `role` column. This trigger blocks
-- any change to `role` (or `banned_at`) unless the caller is an admin.
CREATE OR REPLACE FUNCTION public.profiles_role_immutable_trg()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'crms: only admins can change role'
      USING ERRCODE = 'insufficient_privilege', HINT = 'role_change_admin_only';
  END IF;
  -- banned_at is moderation state, not self-service either
  IF OLD.banned_at IS DISTINCT FROM NEW.banned_at AND NOT public.is_admin() THEN
    -- the existing self-delete flow sets banned_at on the user's own
    -- row; allow that, just not flipping someone else.
    IF auth.uid() IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'crms: only admins can change banned_at on another user'
        USING ERRCODE = 'insufficient_privilege', HINT = 'ban_admin_only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_immutable ON public.profiles;
CREATE TRIGGER profiles_role_immutable
  BEFORE UPDATE OF role, banned_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_role_immutable_trg();

-- ── 3. admin can SELECT every message + conversation ─────────────
DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR conversation_id IN (
      SELECT id FROM public.conversations
       WHERE participant_one = auth.uid() OR participant_two = auth.uid()
    )
  );

DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
CREATE POLICY conversations_select_participant
  ON public.conversations FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR auth.uid() = participant_one
    OR auth.uid() = participant_two
  );

-- ── 4. moderation columns for soft-hide ──────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS hidden_by_admin_at TIMESTAMPTZ;
ALTER TABLE public.student_posts
  ADD COLUMN IF NOT EXISTS hidden_by_admin_at TIMESTAMPTZ;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS hidden_by_admin_at TIMESTAMPTZ;

-- ── 5. admin_set_user_role(target, role) ─────────────────────────
-- One RPC handles both promote and demote. Guards:
--   • Caller must be admin.
--   • new_role must be one of student / employer_mentor / admin.
--   • Cannot demote the last remaining admin.
--   • Caller cannot demote themselves to a non-admin (use a different
--     admin's session for that — protects against accidental lockout).
CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_id UUID, new_role TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_role TEXT;
  current_role TEXT;
  admin_count BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'crms: not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT role::text INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'crms: admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF new_role NOT IN ('student','employer_mentor','admin') THEN
    RAISE EXCEPTION 'crms: invalid role %', new_role
      USING ERRCODE = 'check_violation', HINT = 'invalid_role';
  END IF;
  SELECT role::text INTO current_role FROM public.profiles WHERE id = target_id;
  IF current_role IS NULL THEN
    RAISE EXCEPTION 'crms: user not found'
      USING ERRCODE = 'no_data_found', HINT = 'no_such_user';
  END IF;
  IF current_role = new_role THEN RETURN TRUE; END IF;
  -- last-admin safeguard
  IF current_role = 'admin' AND new_role <> 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'crms: cannot demote the last admin'
        USING ERRCODE = 'check_violation', HINT = 'last_admin';
    END IF;
    IF target_id = auth.uid() THEN
      RAISE EXCEPTION 'crms: admins cannot demote themselves'
        USING ERRCODE = 'check_violation', HINT = 'self_demote';
    END IF;
  END IF;
  -- The role_immutable trigger blocks non-admin role changes; this
  -- function runs as the function owner so the trigger's is_admin()
  -- check still resolves to the caller via auth.uid(). To be safe,
  -- we already verified caller_role = 'admin' above.
  UPDATE public.profiles
     SET role = new_role::public.role_type
   WHERE id = target_id;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;

-- ── 6. admin_set_hidden(table, id, hidden) ───────────────────────
-- Soft-hide a job / student_post / message. Toggleable via the
-- `hidden` boolean. Non-admin readers still see the row unless they're
-- also gated by RLS — for safety the directory queries layer in a
-- `.is('hidden_by_admin_at', null)` filter on the client.
CREATE OR REPLACE FUNCTION public.admin_set_hidden(target_table TEXT, target_id UUID, hidden BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_role TEXT;
  new_ts TIMESTAMPTZ;
BEGIN
  SELECT role::text INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'crms: admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  new_ts := CASE WHEN hidden THEN now() ELSE NULL END;
  IF target_table = 'jobs' THEN
    UPDATE public.jobs SET hidden_by_admin_at = new_ts WHERE id = target_id;
  ELSIF target_table = 'student_posts' THEN
    UPDATE public.student_posts SET hidden_by_admin_at = new_ts WHERE id = target_id;
  ELSIF target_table = 'messages' THEN
    UPDATE public.messages SET hidden_by_admin_at = new_ts WHERE id = target_id;
  ELSE
    RAISE EXCEPTION 'crms: invalid table %', target_table
      USING ERRCODE = 'check_violation', HINT = 'invalid_table';
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_hidden(TEXT, UUID, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_hidden(TEXT, UUID, BOOLEAN) TO authenticated;

-- ── 7. admin_list_conversations() ────────────────────────────────
-- Paged list of conversations with both participants' names, last
-- message timestamp, and message count. SECURITY DEFINER so the admin
-- can read names of admin-hidden profiles via this function even
-- though profiles_hide_admin_rows would otherwise apply.
CREATE OR REPLACE FUNCTION public.admin_list_conversations(p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  message_count BIGINT,
  participant_one UUID,
  participant_one_name TEXT,
  participant_two UUID,
  participant_two_name TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role::text INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'crms: admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
    SELECT c.id,
           c.created_at,
           (SELECT max(created_at) FROM public.messages m WHERE m.conversation_id = c.id) AS last_message_at,
           (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id) AS message_count,
           c.participant_one,
           p1.full_name,
           c.participant_two,
           p2.full_name
      FROM public.conversations c
      LEFT JOIN public.profiles p1 ON p1.id = c.participant_one
      LEFT JOIN public.profiles p2 ON p2.id = c.participant_two
     ORDER BY (SELECT max(created_at) FROM public.messages m WHERE m.conversation_id = c.id) DESC NULLS LAST
     LIMIT GREATEST(0, LEAST(p_limit, 200))
    OFFSET GREATEST(0, p_offset);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_conversations(INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_conversations(INTEGER, INTEGER) TO authenticated;
