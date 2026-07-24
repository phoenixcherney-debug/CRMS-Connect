// Recurring data-access mutations, extracted so the same write isn't
// re-implemented per page (review Architecture A-02). RLS + guard triggers are
// still the real enforcement; these just centralize the query + return its
// error to the caller (each returns a PostgrestBuilder, so callers can await it
// and destructure `{ error }`, or chain `.select()`).

import { supabase } from './supabase'
import type { AccountStatus, OfferStatus, RequestStatus } from '../types'

/** Hide (unlist) or restore an offer — staff-only per RLS. */
export function setOfferHidden(offerId: string, hide: boolean) {
  return supabase
    .from('offers')
    .update({ hidden_at: hide ? new Date().toISOString() : null })
    .eq('id', offerId)
}

/** Change an offer's lifecycle status (open/filled/closed) — poster or staff. */
export function setOfferStatus(offerId: string, status: OfferStatus) {
  return supabase.from('offers').update({ status }).eq('id', offerId)
}

/** Set an account's status (approve / disable / re-enable) — staff-only. */
export function setAccountStatus(userId: string, status: AccountStatus) {
  return supabase.from('profiles').update({ account_status: status }).eq('id', userId)
}

/** Advance a request to a new status. The DB trigger decides which transitions
 *  each actor may make; this centralizes the write and surfaces the error. */
export function advanceRequest(requestId: string, to: RequestStatus) {
  return supabase.from('requests').update({ status: to }).eq('id', requestId)
}
