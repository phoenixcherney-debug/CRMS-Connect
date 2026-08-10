// Pure permission/routing predicates, extracted from the components that used
// to embed them (review: "No DOM/component test layer exists, so every
// permission predicate is only reachable through live-DB e2e").
//
// These are the branching authorization decisions the client makes. RLS and the
// guard triggers remain the real enforcement — but a regression here silently
// shows or hides the wrong controls, and until now the only way to catch that
// was Playwright against the real project. Following the precedent set by
// src/lib/offerForm.ts, the logic lives here as plain functions with plain
// Vitest specs, and the components read as markup.

import type { AccountStatus, OfferStatus, RequestStatus, UserRole } from '../types'

// ---------------------------------------------------------------------------
// Route gate (src/components/guards.tsx)
// ---------------------------------------------------------------------------

export type GateDecision =
  /** Signed in, but the profile row failed to load — offer retry + sign-out. */
  | { kind: 'account-error' }
  | { kind: 'loading' }
  | { kind: 'redirect'; to: string }
  | { kind: 'allow' }

export interface GateInput {
  hasUser: boolean
  accountStatus: AccountStatus | null
  /** Null when there is no profile row (absent, or not loaded yet). */
  hasProfile: boolean
  loading: boolean
  profileError: boolean
  pathname: string
}

/** The five-way account-status routing behind every authenticated route. */
export function gateDecision(input: GateInput): GateDecision {
  const { hasUser, hasProfile, loading, profileError, accountStatus, pathname } = input

  if (hasUser && !hasProfile && profileError) return { kind: 'account-error' }
  if (loading) return { kind: 'loading' }
  // Settled (loading is false) but signed in with no profile row: the row is
  // genuinely absent rather than slow. This used to fall into the loading
  // branch, leaving the user on an infinite spinner with no sign-out affordance.
  if (hasUser && !hasProfile) return { kind: 'account-error' }
  if (!hasUser) return { kind: 'redirect', to: '/login' }

  if (accountStatus === 'pending' && pathname !== '/waiting') {
    return { kind: 'redirect', to: '/waiting' }
  }
  if (accountStatus === 'disabled' && pathname !== '/disabled') {
    return { kind: 'redirect', to: '/disabled' }
  }
  if (accountStatus === 'active' && (pathname === '/waiting' || pathname === '/disabled')) {
    return { kind: 'redirect', to: '/home' }
  }
  return { kind: 'allow' }
}

/** RequireRole's predicate. */
export function roleAllowed(role: UserRole | null | undefined, allowed: UserRole[]): boolean {
  return !!role && allowed.includes(role)
}

// ---------------------------------------------------------------------------
// Thread capabilities (src/pages/shared/Thread.tsx)
// ---------------------------------------------------------------------------

const OPEN_THREAD_STATUSES: RequestStatus[] = ['sent', 'in_conversation', 'accepted']
const UNDECIDED_STATUSES: RequestStatus[] = ['sent', 'in_conversation']

export interface ThreadViewer {
  id: string
  role: UserRole
}

export interface ThreadSubject {
  studentId: string
  /** Null when the offer join came back null (offer removed, or RLS-hidden). */
  posterId: string | null
  offerId: string
  status: RequestStatus
}

export interface ThreadCapabilities {
  isStudent: boolean
  isPoster: boolean
  isAdmin: boolean
  canMessage: boolean
  posterCanDecide: boolean
  studentCanWithdraw: boolean
  /** Where the "back" link goes. */
  backTo: string
  backLabel: string
}

export function threadCapabilities(viewer: ThreadViewer, subject: ThreadSubject): ThreadCapabilities {
  const isStudent = viewer.id === subject.studentId
  const isPoster = subject.posterId !== null && viewer.id === subject.posterId
  const isAdmin = viewer.role === 'admin'

  // The back link used to key its fallback off join state rather than role, so
  // a member whose offer join came back null was sent to /admin/requests —
  // which RequireRole immediately bounces to /home (review nit).
  const backTo = isStudent
    ? '/requests'
    : isPoster
      ? `/offers/${subject.offerId}/manage`
      : isAdmin
        ? '/admin/requests'
        : '/home'
  const backLabel = isStudent
    ? 'My requests'
    : isPoster
      ? 'Your offer'
      : isAdmin
        ? 'All requests'
        : 'Home'

  return {
    isStudent,
    isPoster,
    isAdmin,
    canMessage: OPEN_THREAD_STATUSES.includes(subject.status) && (isStudent || isPoster || isAdmin),
    posterCanDecide: (isPoster || isAdmin) && UNDECIDED_STATUSES.includes(subject.status),
    studentCanWithdraw: isStudent && UNDECIDED_STATUSES.includes(subject.status),
    backTo,
    backLabel,
  }
}

// ---------------------------------------------------------------------------
// Knocking on a door (src/pages/shared/OfferDetail.tsx)
// ---------------------------------------------------------------------------

/** A withdrawn knock no longer occupies the door — it can be knocked on again
 *  (the row is revived in place rather than deleted; see the re-knock blocker). */
export function activeRequestOf<T extends { status: RequestStatus }>(
  request: T | null | undefined,
): T | null {
  if (!request) return null
  return request.status === 'withdrawn' ? null : request
}

export interface CanRaiseInput {
  viewerRole: UserRole | null | undefined
  offerStatus: OfferStatus
  offerHidden: boolean
  /** The offer's poster, or null when RLS hid them (disabled account). */
  poster: { open_to_requests?: boolean } | null | undefined
  /** The viewer's existing non-withdrawn request on this offer, if any. */
  hasActiveRequest: boolean
}

/** Whether the knock form should be offered. Mirrors requests_insert's gates so
 *  the student isn't handed a form the database will reject. */
export function canRaiseHand(input: CanRaiseInput): boolean {
  return (
    input.viewerRole === 'student' &&
    input.offerStatus === 'open' &&
    !input.offerHidden &&
    !input.hasActiveRequest &&
    posterAvailable(input.poster)
  )
}

/** A null poster join means the poster is disabled and RLS hid them. That used
 *  to read as "not paused" — so the student got a knock form, wrote a note, and
 *  the insert came back "You don't have permission to do that" (review). */
export function posterAvailable(poster: { open_to_requests?: boolean } | null | undefined): boolean {
  if (!poster) return false
  return poster.open_to_requests !== false
}
