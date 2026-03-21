-- Soft-delete: stamp deleted_at instead of hard-deleting from auth.users.
-- Users have 30 days to recover before the account is permanently removed.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update the delete function to soft-delete only
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles SET deleted_at = now() WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;

-- Recovery: clear deleted_at to restore the account
CREATE OR REPLACE FUNCTION recover_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET deleted_at = NULL
  WHERE id = auth.uid()
    AND deleted_at IS NOT NULL
    AND deleted_at > now() - INTERVAL '30 days';
END;
$$;

REVOKE ALL ON FUNCTION recover_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recover_own_account() TO authenticated;
