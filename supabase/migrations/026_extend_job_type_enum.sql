-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 026: Extend job_type_enum to absorb opportunity_type values
--
-- We're consolidating the two overlapping fields (Category + Opportunity type,
-- which both contained "Volunteer"). New posts only set job_type. Old rows
-- still keep their opportunity_type for backward read compatibility, but the
-- form no longer shows that field. Adding `mentorship`, `shadow`, and `other`
-- to job_type_enum lets the new form cover everything the old fields did.
--
-- IMPORTANT: ADD VALUE cannot run inside a transaction. If you paste this into
-- the Supabase SQL editor, run each ALTER TYPE on its own line.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'mentorship';
ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'shadow';
ALTER TYPE job_type_enum ADD VALUE IF NOT EXISTS 'other';
