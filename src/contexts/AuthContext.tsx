import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile, Role } from '../types'

// ─── Email validation (client-side) ───────────────────────────────────────────
export function validateEmailForRole(email: string, role: Role): string | null {
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
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!error && data) {
      setProfile(data as Profile)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null
        setUser(u)
        if (u) {
          await fetchProfile(u.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        return { error: 'An account with this email already exists. Please log in.' }
      }
      return { error: error.message }
    }

    const needsVerification = !data.session
    return { error: null, needsVerification }
  }

  // ─── Sign In ───────────────────────────────────────────────────────────────
  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return { error: 'unverified' }
      }
      if (error.message.includes('Invalid login credentials')) {
        return { error: 'Incorrect email or password.' }
      }
      return { error: error.message }
    }
    return { error: null }
  }

  // ─── Sign Out ──────────────────────────────────────────────────────────────
  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}
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
