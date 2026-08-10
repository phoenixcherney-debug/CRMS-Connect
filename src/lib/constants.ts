// Named constants for values that were previously inline magic numbers
// duplicating a schema bound or a config cadence (review nit A-03).

/** offers.spots is constrained to 1–20 in the schema (see v2_rebuild.sql). */
export const MIN_SPOTS = 1
export const MAX_SPOTS = 20

/** profiles.class_year carries `check (class_year between 1950 and 2040)`.
 *  The signup form must reject out-of-range years itself: a violation there
 *  raises inside handle_new_user, which rolls the auth.users insert back, and
 *  GoTrue reports only "Database error saving new user". */
export const MIN_CLASS_YEAR = 1950
export const MAX_CLASS_YEAR = 2040

/** Thread view background-poll cadence. */
export const THREAD_POLL_MS = 15_000
/** Notification unread-count poll cadence. */
export const NOTIF_POLL_MS = 60_000

/** Page size for the board and admin list views (server-side load-more). */
export const PAGE_SIZE = 24

/** profiles.tags carries `check (coalesce(array_length(tags,1),0) <= 10)`. */
export const MAX_TAGS = 10
/** How many audit-log entries the staff page shows. */
export const AUDIT_LOG_LIMIT = 100
/** How long a toast stays up. */
export const TOAST_MS = 4_500
