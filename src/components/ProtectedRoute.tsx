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
  /** SEC-001 — set true on the routes a `pending` account is allowed to
   *  reach (/awaiting-approval, /profile, /onboarding) so we don't loop. */
  skipApprovalGate?: boolean
}

export default function ProtectedRoute({ children, roles, skipOnboarding, skipApprovalGate }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  // Not logged in (or bootstrap timed out) → go to login. The login page has
  // its own "Reset the app" escape hatch for the rare case where caches need
  // to be cleared.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Logged in but email not verified
  if (!user.email_confirmed_at) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />
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

  // SEC-001 — pending employer/mentor accounts land on /awaiting-approval.
  // /profile + /awaiting-approval + /onboarding stay reachable so they can
  // edit details while waiting.
  if (
    !isAdmin
    && !skipApprovalGate
    && profile?.role === 'employer_mentor'
    && profile.account_status === 'pending'
  ) {
    return <Navigate to="/awaiting-approval" replace />
  }

  // Role restriction — admin always passes
  if (!isAdmin && roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/jobs" replace />
  }

  return <>{children}</>
}
