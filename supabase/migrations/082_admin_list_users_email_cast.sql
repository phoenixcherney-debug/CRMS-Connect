-- 082_admin_list_users_email_cast.sql
-- The /admin panel was throwing 'structure of query does not match
-- function result type' because auth.users.email is character
-- varying on the current Supabase platform, while the function's
-- RETURNS TABLE signature declared it as text. Postgres treats those
-- as different types at runtime. Explicit u.email::text fixes it.

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  full_name text,
  role text,
  created_at timestamptz,
  banned_at timestamptz,
  onboarding_complete boolean,
  email text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.role::text, p.created_at,
           p.banned_at, p.onboarding_complete, u.email::text
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
     ORDER BY p.created_at DESC;
END;
$$;
