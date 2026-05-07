-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029: Graduation-year cleanup re-run (audit pass 4 §6)
--
-- Migration 023 already had this scrub, but the audit reports `nick cherney`
-- still has graduation_year=1961 on the live DB. Either 023 wasn't fully run
-- against this row or the row was edited after. Re-run idempotently. Use a
-- range that matches the CHECK constraint added in 023.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.profiles
SET graduation_year = NULL
WHERE graduation_year IS NOT NULL
  AND (
    graduation_year < EXTRACT(YEAR FROM CURRENT_DATE)::INT - 80
    OR graduation_year > EXTRACT(YEAR FROM CURRENT_DATE)::INT + 8
  );
