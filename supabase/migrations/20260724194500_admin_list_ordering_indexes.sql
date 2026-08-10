-- ============================================================================
-- (Minor, performance) Nothing indexed the orderings the staff lists actually use.
--
-- AdminRequests orders every request row by `updated_at desc` but `requests`
-- carried indexes only on (offer_id) and (student_id), so the plan was a full
-- scan plus a top-N sort. That is made worse by requests_select's RLS qual
-- being an OR containing a row reference, which re-evaluates the
-- app_is_admin() SECURITY DEFINER call per scanned row.
--
-- AdminOffers has the same shape: `order('created_at', desc)` with no status
-- predicate, which offers_board_idx (status, created_at desc) cannot serve as
-- an ordered scan.
-- ============================================================================

create index requests_updated_idx on public.requests (updated_at desc);
create index offers_created_idx on public.offers (created_at desc);

notify pgrst, 'reload schema';
