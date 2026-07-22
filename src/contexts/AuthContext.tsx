import { createContext, useCallback, useContext, useEffect, useState } from 'react'
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

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) {
        const { profile: p, failed } = await fetchProfile(session.user.id)
        if (!cancelled) {
          setProfile(p)
          setProfileError(failed)
        }
      }
      if (!cancelled) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        setProfile(null)
        setProfileError(false)
        return
      }
      // Deliberately not awaited: auth callbacks must not block.
      fetchProfile(session.user.id).then(({ profile: p, failed }) => {
        setProfile(p)
        setProfileError(failed)
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
      const { profile: p, failed } = await fetchProfile(current.id)
      setProfile(p)
      setProfileError(failed)
    }
  }, [fetchProfile])

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
