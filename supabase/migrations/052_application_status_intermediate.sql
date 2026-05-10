-- 052_application_status_intermediate.sql
-- P2-18 — intermediate application statuses for richer hiring workflows.
--
-- Hiring isn't binary; the existing enum (pending/reviewed/accepted/
-- rejected/waitlisted) doesn't model the in-flight states. Adding:
--   • interview_scheduled — employer set up a call/interview
--   • offer_sent — formal offer extended (precedes accepted)
--   • started — student is now active in the role
--   • completed — engagement wrapped successfully
--   • withdrawn_by_employer — employer pulled the role / changed plans
--
-- ALTER TYPE ADD VALUE IF NOT EXISTS is idempotent on Postgres 12+ and
-- doesn't break existing rows or the existing 'pending'/'accepted'/
-- 'rejected' branches in the app.

ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'interview_scheduled';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'offer_sent';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'started';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'withdrawn_by_employer';
