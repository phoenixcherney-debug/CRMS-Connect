import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { gateDecision, roleAllowed } from '../lib/permissions'
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

  // The routing itself is a pure function (src/lib/permissions.ts) so every
  // branch below is unit-tested; this component only renders the outcome.
  const decision = gateDecision({
    hasUser: !!user,
    hasProfile: !!profile,
    loading,
    profileError,
    accountStatus: profile?.account_status ?? null,
    pathname: location.pathname,
  })

  // A signed-in user whose profile failed to load: offer a way out instead of
  // spinning forever behind an infinite loader.
  if (decision.kind === 'account-error') {
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

  if (decision.kind === 'loading') return <Spinner page />
  if (decision.kind === 'redirect') {
    return decision.to === '/login'
      ? <Navigate to="/login" state={{ from: location.pathname }} replace />
      : <Navigate to={decision.to} replace />
  }
  return <Outlet />
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { profile } = useAuth()
  if (!roleAllowed(profile?.role, roles)) return <Navigate to="/home" replace />
  return children
}
