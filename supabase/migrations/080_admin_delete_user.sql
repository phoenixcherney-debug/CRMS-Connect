-- 080_admin_delete_user.sql
-- Admin can hard-delete any account from /admin. SECURITY DEFINER so
-- the RPC can DELETE FROM auth.users (which cascades to profiles via
-- the FK that's been in place since migration 001).
--
-- Guards:
--   • Caller must be an admin (role = 'admin' on profiles).
--   • Cannot delete yourself.
--   • Cannot delete the last remaining admin — otherwise the site
--     locks itself out of moderation forever.

CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role  TEXT;
  target_role  TEXT;
  admin_count  BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'crms: not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'crms: admins cannot delete themselves'
      USING ERRCODE = 'check_violation', HINT = 'self_delete_forbidden';
  END IF;

  SELECT role::text INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'crms: admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT role::text INTO target_role FROM public.profiles WHERE id = target_id;
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'crms: user not found'
      USING ERRCODE = 'no_data_found', HINT = 'no_such_user';
  END IF;

  IF target_role = 'admin' THEN
    SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';
    IF admin_count <= 1 THEN
      RAISE EXCEPTION 'crms: cannot delete the last admin'
        USING ERRCODE = 'check_violation', HINT = 'last_admin';
    END IF;
  END IF;

  -- Cascade-deletes profiles + everything FK'd to profiles.
  DELETE FROM auth.users WHERE id = target_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_user(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
