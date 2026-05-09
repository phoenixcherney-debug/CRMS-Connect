-- 044_count_query_indexes.sql
-- H-01 — PostgREST HEAD count queries hit the statement-timeout because
-- the predicates in question don't have supporting indexes, so each
-- count walks the table under RLS. Adding partial / composite indexes
-- so the same counts are served from an index scan instead.
--
-- Predicates audited (from the network tab in the QA pass):
--   • jobs?is_active=eq.true                                   ← already covered
--   • profiles?role=neq.admin&banned_at=is.null
--                  &account_status=neq.pending
--                  &account_status=neq.disabled
--   • notifications?user_id=eq.<id>&read_at=is.null            ← already covered
--   • meeting_requests?recipient_id=eq.<id>&status=eq.pending
--   • messages?is_read=eq.false&sender_id<>?

-- Profiles: partial index of "directory-visible" rows. Most accounts
-- are non-admin, non-banned, active — so the filtered set is small.
CREATE INDEX IF NOT EXISTS idx_profiles_directory_visible
  ON public.profiles (role)
  WHERE banned_at IS NULL
    AND account_status NOT IN ('pending', 'disabled');

-- Meeting requests: pending count for a recipient. Combine the
-- existing (recipient_id) index with a partial filter on status.
CREATE INDEX IF NOT EXISTS idx_meeting_requests_recipient_pending
  ON public.meeting_requests (recipient_id)
  WHERE status = 'pending';

-- Messages: unread count for a conversation. The composite (conversation_id,
-- is_read) supports both the IN(...) predicate from conversations and the
-- is_read filter without a separate sort.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_unread
  ON public.messages (conversation_id)
  WHERE is_read = false;

-- Conversations: lookup by either participant. The unique
-- LEAST/GREATEST index doesn't help equality on a single column,
-- so add separate single-column indexes.
CREATE INDEX IF NOT EXISTS idx_conversations_participant_one
  ON public.conversations (participant_one);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two
  ON public.conversations (participant_two);
