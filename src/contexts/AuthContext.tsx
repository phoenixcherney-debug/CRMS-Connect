import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
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

// ─── Friendly error mapper ────────────────────────────────────────────────────
// "Failed to fetch" can mean three completely different things (offline, paused
// project, real 5xx). Map known shapes to copy a user can act on.
function friendlyAuthError(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.'
  const msg = (err as { message?: string }).message ?? String(err)
  const lower = msg.toLowerCase()

  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Please log in.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (lower.includes('database error') || lower.includes('null value') || lower.includes('23502')) {
    return "We couldn't finish setting up your account. Please contact CRMS support."
  }
  if (lower.includes('weak password') || lower.includes('password')) {
    return 'Please use a stronger password (at least 8 characters).'
  }
  if (lower === 'failed to fetch' || lower.includes('networkerror') || lower.includes('network error')) {
    return "We're having trouble reaching the server. Check your internet connection and try again."
  }
  // Surface server-provided message verbatim if it looks like a sentence.
  if (msg && msg.length < 200) return msg
  return 'Something went wrong. Please try again.'
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
  }) => Promise<{ error: string | null; needsVerification?: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────────
const BOOTSTRAP_TIMEOUT_MS = 5000
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
  }: {
    email: string
    password: string
    fullName: string
    role: Role
  }): Promise<{ error: string | null; needsVerification?: boolean }> {
    const clientError = validateEmailForRole(email, role)
    if (clientError) return { error: clientError }

    const trimmedName = fullName.trim().replace(/\s+/g, ' ')
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      return { error: 'Please enter your full name (2–60 characters).' }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: trimmedName, role },
        },
      })

      if (error) return { error: friendlyAuthError(error) }

      const needsVerification = !data.session
      return { error: null, needsVerification }
    } catch (err) {
      return { error: friendlyAuthError(err) }
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
        if (error.message.includes('Email not confirmed')) {
          return { error: 'unverified' }
        }
        if (error.message.includes('Invalid login credentials')) {
          return { error: 'Incorrect email or password.' }
        }
        return { error: friendlyAuthError(error) }
      }
      return { error: null }
    } catch (err) {
      return { error: friendlyAuthError(err) }
    }
  }

  // ─── Sign Out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut()
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
