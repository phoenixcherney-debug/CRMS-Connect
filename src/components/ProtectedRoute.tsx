import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'
import Spinner from './Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** If provided, only these roles may access. Others are sent to /jobs. */
  roles?: Role[]
  /** Set true on the /onboarding route itself to avoid an infinite redirect loop. */
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

  // Not logged in → go to login, preserving intended destination
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Logged in but email not verified
  if (!user.email_confirmed_at) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="max-w-sm w-full text-center bg-surface rounded-2xl border border-border p-8 shadow-sm">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-semibold text-ink mb-2">Check your inbox</h2>
          <p className="text-ink-secondary text-sm leading-relaxed">
            We sent a verification link to <strong>{user.email}</strong>. Click the
            link in that email to activate your account.
          </p>
        </div>
      </div>
    )
  }

  // New user who hasn't finished onboarding → send to setup screen
  if (!skipOnboarding && profile && !profile.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }

  // Role restriction — redirect non-matching roles to jobs page
  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/jobs" replace />
  }

  return <>{children}</>
}
