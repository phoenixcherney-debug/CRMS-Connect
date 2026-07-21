import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Spinner } from './ui/Spinner'
import type { UserRole } from '../types'

/** Auth + account-status gate for everything behind login. RLS is the real
 *  enforcement; these redirects are UX. */
export function Gate() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

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
