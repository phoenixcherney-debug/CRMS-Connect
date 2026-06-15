-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 091: pin search_path on the remaining mutable-search_path functions (A3)
--
-- 25 functions (sanitize / text-filter triggers + helpers) had no explicit
-- search_path, which the security advisor flags as mutable (injection-hardening).
-- They reference only public + pg_catalog objects (often via UNqualified names
-- like crms_clean_text), so we pin to `pg_catalog, public` — this removes the
-- mutability without the breakage that `search_path = ''` would cause by forcing
-- full qualification.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.applications_check_text_filter_trg()        SET search_path = pg_catalog, public;
ALTER FUNCTION public.applications_sanitize_trg()                 SET search_path = pg_catalog, public;
ALTER FUNCTION public.career_history_sanitize_trg()              SET search_path = pg_catalog, public;
ALTER FUNCTION public.close_expired_jobs()                       SET search_path = pg_catalog, public;
ALTER FUNCTION public.events_sanitize_trg()                      SET search_path = pg_catalog, public;
ALTER FUNCTION public.jobs_check_text_filter_trg()              SET search_path = pg_catalog, public;
ALTER FUNCTION public.jobs_sanitize_trg()                        SET search_path = pg_catalog, public;
ALTER FUNCTION public.jobs_validate_custom_questions_trg()       SET search_path = pg_catalog, public;
ALTER FUNCTION public.jobs_validate_custom_questions_v2_trg()    SET search_path = pg_catalog, public;
ALTER FUNCTION public.meeting_requests_sanitize_trg()            SET search_path = pg_catalog, public;
ALTER FUNCTION public.mentor_shortlist_validate_roles_trg()      SET search_path = pg_catalog, public;
ALTER FUNCTION public.messages_check_text_filter_trg()          SET search_path = pg_catalog, public;
ALTER FUNCTION public.messages_sanitize_trg()                    SET search_path = pg_catalog, public;
ALTER FUNCTION public.profiles_check_text_filter_trg()          SET search_path = pg_catalog, public;
ALTER FUNCTION public.profiles_mentor_consent_stamp_trg()        SET search_path = pg_catalog, public;
ALTER FUNCTION public.profiles_sanitize_trg()                    SET search_path = pg_catalog, public;
ALTER FUNCTION public.profiles_validate_sections_trg()           SET search_path = pg_catalog, public;
ALTER FUNCTION public.set_marketplace_updated_at()              SET search_path = pg_catalog, public;
ALTER FUNCTION public.student_posts_check_text_filter_trg()      SET search_path = pg_catalog, public;
ALTER FUNCTION public.student_posts_sanitize_trg()              SET search_path = pg_catalog, public;
ALTER FUNCTION public.user_reports_sanitize_trg()               SET search_path = pg_catalog, public;
ALTER FUNCTION public.crms_clean_text(text)                      SET search_path = pg_catalog, public;
ALTER FUNCTION public.crms_reject_sqli(text)                     SET search_path = pg_catalog, public;
ALTER FUNCTION public.crms_strip_html(text)                      SET search_path = pg_catalog, public;
ALTER FUNCTION public.text_has_blocked_terms(text)               SET search_path = pg_catalog, public;
