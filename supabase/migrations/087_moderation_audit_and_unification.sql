-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 087: moderation foundation (A9 audit log + C2/C3 unification)
--
-- A9  — admin_audit_log table + admin_log() helper; every admin RPC records an
--       entry (actor, action, target, metadata). Read-only to admins via RLS;
--       only the SECURITY DEFINER RPCs (postgres-owned) can write.
-- C2/C3 — `banned_at` is the canonical "blocked" state. admin_unban_user now
--       also clears a stale account_status='disabled' so unban fully restores a
--       user, and we backfill any disabled rows to ensure banned_at is set. The
--       AdminReports "Disable" path moves to admin_ban_user on the client.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A9: audit log table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_id  ON public.admin_audit_log(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_id   ON public.admin_audit_log(actor_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_audit_log_select_admin ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_admin ON public.admin_audit_log
  FOR SELECT USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policy: only the postgres-owned SECURITY DEFINER
-- functions below (which bypass RLS) can write.

-- ── admin_log helper ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_log(
  p_action text, p_target_type text, p_target_id uuid, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;
-- Not directly callable by clients (only invoked internally by the admin RPCs).
REVOKE EXECUTE ON FUNCTION public.admin_log(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ── Ban / unban (+ audit, + unban restores account_status) ───────────────────
CREATE OR REPLACE FUNCTION public.admin_ban_user(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  IF target_id = auth.uid() THEN RAISE EXCEPTION 'Admin cannot ban themselves'; END IF;
  UPDATE public.profiles SET banned_at = now() WHERE id = target_id;
  PERFORM public.admin_log('ban_user', 'profile', target_id, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(target_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Forbidden: admin only'; END IF;
  UPDATE public.profiles
     SET banned_at = NULL,
         account_status = CASE WHEN account_status = 'disabled'::public.account_status_t
                               THEN 'active'::public.account_status_t
                               ELSE account_status END
   WHERE id = target_id;
  PERFORM public.admin_log('unban_user', 'profile', target_id, '{}'::jsonb);
END;
$function$;

-- ── Role change (+ audit) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_id uuid, new_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    RAISE EXCEPTION 'crms: invalid role %', new_role USING ERRCODE = 'check_violation', HINT = 'invalid_role';
  END IF;
  SELECT role::text INTO current_role FROM public.profiles WHERE id = target_id;
  IF current_role IS NULL THEN
    RAISE EXCEPTION 'crms: user not found' USING ERRCODE = 'no_data_found', HINT = 'no_such_user';
  END IF;
  IF current_role = new_role THEN RETURN TRUE; END IF;
  IF current_role = 'admin' AND new_role <> 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'crms: cannot demote the last admin' USING ERRCODE = 'check_violation', HINT = 'last_admin';
    END IF;
    IF target_id = auth.uid() THEN
      RAISE EXCEPTION 'crms: admins cannot demote themselves' USING ERRCODE = 'check_violation', HINT = 'self_demote';
    END IF;
  END IF;
  UPDATE public.profiles SET role = new_role::public.role_type WHERE id = target_id;
  PERFORM public.admin_log('set_role', 'profile', target_id,
                           jsonb_build_object('from', current_role, 'to', new_role));
  RETURN TRUE;
END;
$function$;

-- ── Delete user (log BEFORE the cascade delete) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  caller_role  TEXT;
  target_role  TEXT;
  admin_count  BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'crms: not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'crms: admins cannot delete themselves' USING ERRCODE = 'check_violation', HINT = 'self_delete_forbidden';
  END IF;
  SELECT role::text INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'crms: admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT role::text INTO target_role FROM public.profiles WHERE id = target_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'crms: user not found' USING ERRCODE = 'no_data_found', HINT = 'no_such_user';
  END IF;
  IF target_role = 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'crms: cannot delete the last admin' USING ERRCODE = 'check_violation', HINT = 'last_admin';
    END IF;
  END IF;
  PERFORM public.admin_log('delete_user', 'profile', target_id, jsonb_build_object('role', target_role));
  DELETE FROM auth.users WHERE id = target_id;
  RETURN TRUE;
END;
$function$;

-- ── Hide content (+ audit) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_hidden(target_table text, target_id uuid, hidden boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
    RAISE EXCEPTION 'crms: invalid table %', target_table USING ERRCODE = 'check_violation', HINT = 'invalid_table';
  END IF;
  PERFORM public.admin_log(CASE WHEN hidden THEN 'hide_content' ELSE 'unhide_content' END,
                           target_table, target_id, '{}'::jsonb);
  RETURN TRUE;
END;
$function$;

-- ── C2/C3 backfill: ensure existing disabled rows are blocked under banned_at ─
UPDATE public.profiles SET banned_at = now()
WHERE account_status = 'disabled'::public.account_status_t AND banned_at IS NULL;

NOTIFY pgrst, 'reload schema';
