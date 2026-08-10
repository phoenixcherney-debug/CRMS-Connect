import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { MemberAffiliation, Profile } from '../types'

export interface SignUpParams {
  email: string
  password: string
  fullName: string
  role: 'student' | 'member'
  affiliation?: MemberAffiliation
  classYear?: number
  organization?: string
  title?: string
}

interface AuthContextValue {
  user: User | null
  profile: Profile | null
  /** True until the initial session + profile fetch settles. */
  loading: boolean
  /** Set when a signed-in user's profile row failed to load (network/RLS
   *  error) — distinct from a genuinely absent profile. Lets route guards
   *  show a retry instead of spinning forever. */
  profileError: boolean
  signUp: (params: SignUpParams) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)

  // Returns { profile, failed } so callers can tell a network/RLS failure
  // (failed=true) apart from a genuinely missing row (profile=null, failed=false).
  const fetchProfile = useCallback(async (userId: string): Promise<{ profile: Profile | null; failed: boolean }> => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) {
      console.error('profile fetch failed:', error)
      return { profile: null, failed: true }
    }
    return { profile: data, failed: false }
  }, [])

  // Tracks the user id the current `profile` belongs to, so a repeat event for
  // the same identity can be recognised without re-reading state in the
  // callback's stale closure.
  const loadedForUserId = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // One fetch path. supabase-js invokes this callback with INITIAL_SESSION as
    // soon as a listener subscribes, so it already covers the cold load — the
    // separate getSession() fetch that used to sit here meant every page load
    // issued `profiles?id=eq.X` twice with no dedupe.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      const nextUser = session?.user ?? null

      if (!nextUser) {
        setUser(null)
        setProfile(null)
        setProfileError(false)
        loadedForUserId.current = null
        setLoading(false)
        return
      }

      // Keep the *same* User object across events that don't change identity.
      // Handing consumers a freshly-parsed object rebuilt every useCallback
      // keyed on `user` and tore down NotificationBell's 60s interval on each
      // emission. USER_UPDATED genuinely carries new fields, so it passes through.
      setUser((prev) => (prev && prev.id === nextUser.id && event !== 'USER_UPDATED' ? prev : nextUser))

      // TOKEN_REFRESHED fires roughly hourly and on tab re-focus and says
      // nothing about the profile row. Refetching there gave `profile` a new
      // identity, which re-ran every usePageData loader on the mounted page.
      if (event === 'TOKEN_REFRESHED' && loadedForUserId.current === nextUser.id) {
        setLoading(false)
        return
      }

      loadedForUserId.current = nextUser.id
      // Deliberately not awaited: auth callbacks must not block.
      fetchProfile(nextUser.id).then(({ profile: p, failed }) => {
        if (cancelled) return
        setProfile(p)
        setProfileError(failed)
        setLoading(false)
      })
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = useCallback(async ({ email, password, fullName, role, affiliation, classYear, organization, title }: SignUpParams) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        // Shape must match handle_new_user() in the v2_rebuild migration.
        data: {
          role,
          full_name: fullName.trim(),
          affiliation: affiliation ?? null,
          class_year: classYear ? String(classYear) : null,
          organization: organization?.trim() || null,
          title: title?.trim() || null,
        },
      },
    })
    if (error) return { error: error.message, needsConfirmation: false }
    // With email confirmation enabled, signUp succeeds without a session.
    return { error: null, needsConfirmation: !data.session }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    return { error: error ? error.message : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data: { user: current } } = await supabase.auth.getUser()
    if (current) {
      loadedForUserId.current = current.id
      const { profile: p, failed } = await fetchProfile(current.id)
      setProfile(p)
      setProfileError(failed)
    }
  }, [fetchProfile])

  // Memoized so consumers don't re-render on every provider render with
  // identical data — the callbacks are already stable useCallbacks.
  const value = useMemo(
    () => ({ user, profile, loading, profileError, signUp, signIn, signOut, refreshProfile }),
    [user, profile, loading, profileError, signUp, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
