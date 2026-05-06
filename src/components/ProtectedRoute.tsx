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

async function clearAppCachesAndReload() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } finally {
    window.location.reload()
  }
}

export default function ProtectedRoute({ children, roles, skipOnboarding }: ProtectedRouteProps) {
  const { user, profile, loading, bootstrapTimedOut } = useAuth()
  const location = useLocation()

  if (bootstrapTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-4">
        <h1 className="text-lg font-semibold text-ink">We couldn't load CRMS Connect</h1>
        <p className="text-sm text-ink-secondary max-w-sm">
          The app is taking too long to start. This usually means a network problem
          or a stale cached version of the site.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-gold px-4 py-2.5"
          >
            Reload
          </button>
          <button
            onClick={clearAppCachesAndReload}
            className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
          >
            Reset & reload
          </button>
        </div>
      </div>
    )
  }

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
    return <Navigate to="/jobs" replace />
  }

  return <>{children}</>
}
