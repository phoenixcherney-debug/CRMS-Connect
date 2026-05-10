-- 051_messages_is_system.sql
-- P1-4 — flag column so we can render auto-inserted "Application accepted"
-- messages distinctly from real user messages.
--
-- The existing RLS policy on messages keys off conversation membership +
-- sender_id = auth.uid(); auto-messages keep sender_id pointed at the
-- employer (the one who triggered them), so RLS continues to work.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;
