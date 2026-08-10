import { describe, it, expect } from 'vitest'
import {
  activeRequestOf,
  canRaiseHand,
  gateDecision,
  posterAvailable,
  roleAllowed,
  threadCapabilities,
} from './permissions'
import type { GateInput } from './permissions'

const SIGNED_IN_ACTIVE: GateInput = {
  hasUser: true,
  hasProfile: true,
  loading: false,
  profileError: false,
  accountStatus: 'active',
  pathname: '/home',
}

describe('gateDecision', () => {
  it('lets an active account through', () => {
    expect(gateDecision(SIGNED_IN_ACTIVE)).toEqual({ kind: 'allow' })
  })

  it('sends a signed-out visitor to the login page', () => {
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, hasUser: false, hasProfile: false }))
      .toEqual({ kind: 'redirect', to: '/login' })
  })

  it('holds the spinner while the session is still settling', () => {
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, loading: true }).kind).toBe('loading')
  })

  it('holds the spinner for a signed-in user whose profile has not arrived yet', () => {
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, hasProfile: false, loading: true }).kind).toBe('loading')
  })

  it('offers an escape hatch when the profile genuinely failed to load', () => {
    // Distinct from "still loading": this branch must not spin forever.
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, hasProfile: false, profileError: true }))
      .toEqual({ kind: 'account-error' })
  })

  it('offers an escape hatch when the profile row is simply absent', () => {
    // loading has settled and there was no error — the row really isn't there.
    // This used to be indistinguishable from "still loading", so the user sat
    // on a spinner forever with no way to sign out.
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, hasProfile: false }))
      .toEqual({ kind: 'account-error' })
  })

  it('parks a pending account on /waiting and lets it stay there', () => {
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, accountStatus: 'pending' }))
      .toEqual({ kind: 'redirect', to: '/waiting' })
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, accountStatus: 'pending', pathname: '/waiting' }))
      .toEqual({ kind: 'allow' })
  })

  it('parks a disabled account on /disabled and lets it stay there', () => {
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, accountStatus: 'disabled' }))
      .toEqual({ kind: 'redirect', to: '/disabled' })
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, accountStatus: 'disabled', pathname: '/disabled' }))
      .toEqual({ kind: 'allow' })
  })

  it('pulls a newly-approved account off the holding pages', () => {
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, pathname: '/waiting' }))
      .toEqual({ kind: 'redirect', to: '/home' })
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, pathname: '/disabled' }))
      .toEqual({ kind: 'redirect', to: '/home' })
  })

  it('does not strand a pending account behind the error branch', () => {
    // profileError only matters when there is no profile to route on.
    expect(gateDecision({ ...SIGNED_IN_ACTIVE, accountStatus: 'pending', profileError: true }))
      .toEqual({ kind: 'redirect', to: '/waiting' })
  })
})

describe('roleAllowed', () => {
  it('admits a listed role', () => {
    expect(roleAllowed('member', ['member', 'admin'])).toBe(true)
    expect(roleAllowed('admin', ['member', 'admin'])).toBe(true)
  })

  it('refuses an unlisted role', () => {
    expect(roleAllowed('student', ['member', 'admin'])).toBe(false)
  })

  it('refuses when there is no profile yet', () => {
    expect(roleAllowed(null, ['student'])).toBe(false)
    expect(roleAllowed(undefined, ['student'])).toBe(false)
  })
})

describe('threadCapabilities', () => {
  const STUDENT = { id: 'stu', role: 'student' as const }
  const POSTER = { id: 'pos', role: 'member' as const }
  const STAFF = { id: 'adm', role: 'admin' as const }
  const OTHER_MEMBER = { id: 'other', role: 'member' as const }
  const subject = (status: 'sent' | 'in_conversation' | 'accepted' | 'declined' | 'withdrawn') => ({
    studentId: 'stu', posterId: 'pos', offerId: 'off', status,
  })

  it('lets the student and the poster talk while the thread is live', () => {
    for (const status of ['sent', 'in_conversation', 'accepted'] as const) {
      expect(threadCapabilities(STUDENT, subject(status)).canMessage).toBe(true)
      expect(threadCapabilities(POSTER, subject(status)).canMessage).toBe(true)
    }
  })

  it('closes the composer once the thread is settled', () => {
    for (const status of ['declined', 'withdrawn'] as const) {
      expect(threadCapabilities(STUDENT, subject(status)).canMessage).toBe(false)
      expect(threadCapabilities(POSTER, subject(status)).canMessage).toBe(false)
      expect(threadCapabilities(STAFF, subject(status)).canMessage).toBe(false)
    }
  })

  it('gives only the poster and staff the accept/decline controls', () => {
    expect(threadCapabilities(POSTER, subject('sent')).posterCanDecide).toBe(true)
    expect(threadCapabilities(STAFF, subject('sent')).posterCanDecide).toBe(true)
    expect(threadCapabilities(STUDENT, subject('sent')).posterCanDecide).toBe(false)
  })

  it('withdraws the decide controls once the request is decided', () => {
    expect(threadCapabilities(POSTER, subject('accepted')).posterCanDecide).toBe(false)
    expect(threadCapabilities(POSTER, subject('declined')).posterCanDecide).toBe(false)
  })

  it('lets only the student withdraw, and only while undecided', () => {
    expect(threadCapabilities(STUDENT, subject('sent')).studentCanWithdraw).toBe(true)
    expect(threadCapabilities(STUDENT, subject('in_conversation')).studentCanWithdraw).toBe(true)
    expect(threadCapabilities(STUDENT, subject('accepted')).studentCanWithdraw).toBe(false)
    expect(threadCapabilities(POSTER, subject('sent')).studentCanWithdraw).toBe(false)
  })

  it('gives a non-participant member no capabilities at all', () => {
    const caps = threadCapabilities(OTHER_MEMBER, subject('sent'))
    expect(caps.canMessage).toBe(false)
    expect(caps.posterCanDecide).toBe(false)
    expect(caps.studentCanWithdraw).toBe(false)
  })

  it('routes the back link by role, not by join state', () => {
    expect(threadCapabilities(STUDENT, subject('sent')).backTo).toBe('/requests')
    expect(threadCapabilities(POSTER, subject('sent')).backTo).toBe('/offers/off/manage')
    expect(threadCapabilities(STAFF, subject('sent')).backTo).toBe('/admin/requests')
  })

  it('sends a member with a null offer join home, not to the staff desk', () => {
    // A null poster used to drop through to '/admin/requests', which
    // RequireRole immediately bounces back to /home.
    const caps = threadCapabilities(POSTER, { ...subject('sent'), posterId: null })
    expect(caps.isPoster).toBe(false)
    expect(caps.backTo).toBe('/home')
  })
})

describe('activeRequestOf', () => {
  it('treats a withdrawn knock as no longer occupying the door', () => {
    expect(activeRequestOf({ status: 'withdrawn' as const })).toBeNull()
  })

  it('keeps every other status active', () => {
    for (const status of ['sent', 'in_conversation', 'accepted', 'declined'] as const) {
      expect(activeRequestOf({ status })).toEqual({ status })
    }
  })

  it('passes null and undefined straight through', () => {
    expect(activeRequestOf(null)).toBeNull()
    expect(activeRequestOf(undefined)).toBeNull()
  })
})

describe('posterAvailable', () => {
  it('treats a missing poster join as unavailable', () => {
    // RLS hides a disabled poster's profile; this used to read as "not paused",
    // so the student got a knock form the insert would then reject.
    expect(posterAvailable(null)).toBe(false)
    expect(posterAvailable(undefined)).toBe(false)
  })

  it('treats an explicit pause as unavailable', () => {
    expect(posterAvailable({ open_to_requests: false })).toBe(false)
  })

  it('treats an open poster as available', () => {
    expect(posterAvailable({ open_to_requests: true })).toBe(true)
    // The board join doesn't always select the column.
    expect(posterAvailable({})).toBe(true)
  })
})

describe('canRaiseHand', () => {
  const open = {
    viewerRole: 'student' as const,
    offerStatus: 'open' as const,
    offerHidden: false,
    poster: { open_to_requests: true },
    hasActiveRequest: false,
  }

  it('offers the form on an open door to a student with no live knock', () => {
    expect(canRaiseHand(open)).toBe(true)
  })

  it('never offers it to members or staff', () => {
    expect(canRaiseHand({ ...open, viewerRole: 'member' })).toBe(false)
    expect(canRaiseHand({ ...open, viewerRole: 'admin' })).toBe(false)
    expect(canRaiseHand({ ...open, viewerRole: null })).toBe(false)
  })

  it('closes on a filled, closed, or draft offer', () => {
    for (const offerStatus of ['filled', 'closed', 'draft'] as const) {
      expect(canRaiseHand({ ...open, offerStatus })).toBe(false)
    }
  })

  it('closes on an unlisted offer', () => {
    expect(canRaiseHand({ ...open, offerHidden: true })).toBe(false)
  })

  it('closes when the student already has a live knock', () => {
    expect(canRaiseHand({ ...open, hasActiveRequest: true })).toBe(false)
  })

  it('closes when the poster is paused or hidden', () => {
    expect(canRaiseHand({ ...open, poster: { open_to_requests: false } })).toBe(false)
    expect(canRaiseHand({ ...open, poster: null })).toBe(false)
  })
})
