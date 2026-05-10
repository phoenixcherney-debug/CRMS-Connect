-- 057_drop_same_role_dm_block.sql
-- P0-6 — drop the BEFORE INSERT trigger added in 037 that rejected
-- conversations where both participants share a role.
--
-- The product decision (May 2026 audit, P0-6): same-role DMs are now
-- allowed in both directions. The trigger and its function go; the UI
-- gates that hid the Message button between same-role pairs were
-- removed in the same change. The /for-mentors marketing copy is
-- updated to match.

DROP TRIGGER IF EXISTS conversations_block_same_role ON public.conversations;
DROP FUNCTION IF EXISTS public.conversations_block_same_role_trg();
