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

  // Not logged in → go to login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Logged in but email not verified
  if (!user.email_confirmed_at) {
    return <Navigate to="/verify-email" state={{ email: user.email }} replace />
  }

  // New user who hasn't finished onboarding
  if (!skipOnboarding && profile && !profile.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }

  // Role restriction
  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/jobs" replace />
  }

  return <>{children}</>
}
