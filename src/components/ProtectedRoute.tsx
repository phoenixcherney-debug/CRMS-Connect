import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'
import Spinner from './Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** If provided, only these roles may access. Others are redirected to /jobs. */
  roles?: Role[]
  /** Set true on /onboarding to avoid redirect loop. */
  skipOnboarding?: boolean
}

export default function ProtectedRoute({ children, roles, skipOnboarding }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Not logged in (or bootstrap timed out) → go to login. P1-10: also
  // pass the intended destination as a `?next=` URL param so it survives
  // a hard refresh / new-tab open. The router state is the fallback.
  if (!user) {
    const next = location.pathname + location.search + location.hash
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/explore'
    const qs = safeNext === '/login' ? '' : `?next=${encodeURIComponent(safeNext)}`
    return <Navigate to={`/login${qs}`} state={{ from: location }} replace />
  }

  // Banned user — redirect to suspension page (check before onboarding/role)
  if (profile?.banned_at && location.pathname !== '/banned') {
    return <Navigate to="/banned" replace />
  }

  const isAdmin = profile?.role === 'admin'

  // Admin bypasses onboarding (admin accounts are created via SQL, not signup)
  if (!isAdmin && !skipOnboarding && profile && !profile.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }

  // Role restriction — admin always passes
  if (!isAdmin && roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/opportunities" replace />
  }

  return <>{children}</>
}
