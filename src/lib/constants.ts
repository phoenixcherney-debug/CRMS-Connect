// Named constants for values that were previously inline magic numbers
// duplicating a schema bound or a config cadence (review nit A-03).

/** offers.spots is constrained to 1–20 in the schema (see v2_rebuild.sql). */
export const MIN_SPOTS = 1
export const MAX_SPOTS = 20

/** Thread view background-poll cadence. */
export const THREAD_POLL_MS = 15_000
/** Notification unread-count poll cadence. */
export const NOTIF_POLL_MS = 60_000

/** Page size for the board and admin list views (server-side load-more). */
export const PAGE_SIZE = 24
