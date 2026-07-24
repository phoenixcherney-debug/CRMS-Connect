import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSignOut } from '../lib/useSignOut'
import { Spinner } from './ui/Spinner'
import { Button } from './ui/Button'
import type { UserRole } from '../types'

/** Auth + account-status gate for everything behind login. RLS is the real
 *  enforcement; these redirects are UX. */
export function Gate() {
  const { user, profile, loading, profileError, refreshProfile } = useAuth()
  const location = useLocation()
  const signOut = useSignOut()

  // A signed-in user whose profile failed to load: offer a way out instead of
  // spinning forever behind an infinite loader.
  if (user && !profile && profileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-8 text-center">
          <h1 className="text-2xl">We couldn’t load your account</h1>
          <p className="mt-3 text-sm leading-relaxed text-faint">
            Something went wrong reaching the server. Check your connection and try again.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => refreshProfile()}>Try again</Button>
            <Button variant="ghost" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading || (user && !profile)) return <Spinner page />
  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (profile.account_status === 'pending' && location.pathname !== '/waiting') {
    return <Navigate to="/waiting" replace />
  }
  if (profile.account_status === 'disabled' && location.pathname !== '/disabled') {
    return <Navigate to="/disabled" replace />
  }
  if (profile.account_status === 'active' && (location.pathname === '/waiting' || location.pathname === '/disabled')) {
    return <Navigate to="/home" replace />
  }
  return <Outlet />
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { profile } = useAuth()
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/home" replace />
  return children
}
