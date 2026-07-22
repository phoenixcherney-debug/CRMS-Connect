-- handle_email_confirmed is an auth.users trigger function; it must not be
-- callable through PostgREST. (The RLS helpers app_user_active / app_has_* keep
-- their authenticated grant because RLS policy expressions execute as the caller.)
revoke execute on function public.handle_email_confirmed() from public, anon, authenticated;

notify pgrst, 'reload schema';
