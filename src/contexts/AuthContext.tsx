import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { validateDisplayName } from '../lib/nameFilter'
import { validateFullNameShape, containsBlockedTerms } from '../lib/textFilter'
import { formatDisplayName } from '../lib/displayName'
import type { Profile, Role } from '../types'

// ─── Email validation (client-side) ───────────────────────────────────────────
export function validateEmailForRole(email: string, role: Role): string | null {
  if (role === 'admin') return null
  if (!email || !email.includes('@')) return 'Please enter a valid email address.'
  const isSchoolEmail = email.trim().toLowerCase().endsWith('@crms.org')
  if (role === 'student' && !isSchoolEmail) {
    return 'Student accounts require a @crms.org school email address.'
  }
  if (role === 'employer_mentor' && isSchoolEmail) {
    return 'Please use a personal email address, not your school email.'
  }
  return null
}

// ─── Context types ─────────────────────────────────────────────────────────────
interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  bootstrapTimedOut: boolean
  signUp: (params: {
    email: string
    password: string
    fullName: string
    role: Role
    /** Phase 4.6 — inviter UUID from `?invited_by=` query string. */
    invitedBy?: string | null
  }) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────────
// Aggressive bootstrap timeout: getSession() reads from localStorage and is
// supposed to be fast, but if the SDK decides to refresh an expired token or
// the project is paused, it can hang indefinitely. 3s is well above any honest
// localStorage-only path and well below user impatience.
const BOOTSTRAP_TIMEOUT_MS = 3000
const PROFILE_FETCH_TIMEOUT_MS = 5000

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => { window.clearTimeout(t); resolve(v) },
      (e) => { window.clearTimeout(t); reject(e) },
    )
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Kept on the context so consumers can detect a degraded bootstrap if they
  // want to show a banner. We do NOT block the UI on it any more — the timeout
  // resolves to "logged-out" and the user lands on /login automatically.
  const [bootstrapTimedOut, setBootstrapTimedOut] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // PostgrestBuilder is then-able (PromiseLike) but not a real Promise.
      const query = supabase.from('profiles').select('*').eq('id', userId).single()
      const { data, error } = await withTimeout(query, PROFILE_FETCH_TIMEOUT_MS, 'Profile fetch')
      if (!error && data) setProfile(data as Profile)
    } catch (err) {
      console.warn('[AuthContext] fetchProfile failed:', err)
      // Don't block the UI — the user can still navigate; the profile will be
      // re-fetched on next auth event or refresh.
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  useEffect(() => {
    let resolved = false

    // Hard timeout: if getSession() never resolves (stale SW, broken network,
    // paused Supabase project), treat the bootstrap as "no session" so the
    // user lands on /login instead of an indefinite spinner. A real session
    // event later will still upgrade them via onAuthStateChange.
    const timeoutId = window.setTimeout(() => {
      if (resolved) return
      resolved = true
      console.warn('[AuthContext] auth bootstrap timed out — treating as logged-out')
      setBootstrapTimedOut(true)
      setUser(null)
      setProfile(null)
      setLoading(false)
    }, BOOTSTRAP_TIMEOUT_MS)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (resolved) return
      resolved = true
      window.clearTimeout(timeoutId)
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        // Don't block the loading flag on the profile fetch — the route can
        // render while we hydrate the profile in the background.
        setLoading(false)
        void fetchProfile(u.id)
      } else {
        setLoading(false)
      }
    }).catch((err) => {
      if (resolved) return
      resolved = true
      window.clearTimeout(timeoutId)
      console.warn('[AuthContext] getSession failed:', err)
      setUser(null)
      setProfile(null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          void fetchProfile(u.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
        setBootstrapTimedOut(false)
      }
    )

    return () => {
      window.clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // ─── Sign Up ───────────────────────────────────────────────────────────────
  async function signUp({
    email,
    password,
    fullName,
    role,
    invitedBy,
  }: {
    email: string
    password: string
    fullName: string
    role: Role
    invitedBy?: string | null
  }): Promise<{ error: string | null }> {
    const clientError = validateEmailForRole(email, role)
    if (clientError) return { error: clientError }

    const trimmedName = fullName.trim().replace(/\s+/g, ' ')
    if (trimmedName.length < 2 || trimmedName.length > 80) {
      return { error: 'Please enter your full name (2–80 characters).' }
    }
    // SEC-003 — display-name moderation. The DB also runs this in the
    // sanitize trigger; doing it here gives a friendly error before submit.
    const nameCheck = validateDisplayName(trimmedName)
    if (!nameCheck.ok) return { error: nameCheck.reason ?? 'That display name isn\'t allowed.' }
    // Task 1 — additionally enforce real-name shape (2+ tokens, no digits)
    // and a broader text-filter pass. validateDisplayName covers slurs;
    // these add the "must look like a real first+last" rule on signup.
    const shape = validateFullNameShape(trimmedName)
    if (shape.blocked) return { error: shape.reason ?? 'Please use your real first and last name.' }
    const term = containsBlockedTerms(trimmedName)
    if (term.blocked) return { error: term.reason ?? 'That name isn\'t allowed.' }
    // P2-20 — normalize casing at signup so the stored value is the
    // canonical display form (no separate render-time helper drift).
    const canonicalName = formatDisplayName(trimmedName)

    try {
      // Phase 4.6 — only attach invited_by when it parses as a UUID. The
      // DB trigger guards against junk too, but trimming here keeps the
      // metadata payload honest.
      const uuidish = invitedBy && /^[0-9a-f-]{36}$/i.test(invitedBy) ? invitedBy : undefined
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: canonicalName,
            role,
            ...(uuidish ? { invited_by: uuidish } : {}),
          },
        },
      })

      if (error) return { error: friendlyError(error) }
      return { error: null }
    } catch (err) {
      return { error: friendlyError(err) }
    }
  }

  // ─── Sign In ───────────────────────────────────────────────────────────────
  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Incorrect email or password.' }
        }
        return { error: friendlyError(error) }
      }
      return { error: null }
    } catch (err) {
      return { error: friendlyError(err) }
    }
  }

  // ─── Sign Out ──────────────────────────────────────────────────────────────
  // Clear local state synchronously so the React tree stops rendering the
  // previous user immediately (ProtectedRoute will bounce to /login on the
  // next render). Then fire Supabase signOut for token revocation. The
  // onAuthStateChange listener will run too — that's fine, our state is
  // already null.
  async function signOut() {
    setUser(null)
    setProfile(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('[AuthContext] signOut failed:', err)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, bootstrapTimedOut, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
