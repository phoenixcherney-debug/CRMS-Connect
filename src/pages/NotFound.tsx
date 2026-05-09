import { Link, useLocation } from 'react-router-dom'
import { Compass, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Catch-all 404. Renders inside the same Layout as the rest of the app so
 * the user keeps their navigation chrome — replacing the previous behavior
 * of silently redirecting any unknown path to /explore (audit M6).
 */
export default function NotFound() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  // P2-27 — return-link adapts to auth state. "Back to dashboard" only
  // makes sense once the user is signed in.
  const target = user ? '/explore' : '/login'
  const label = user ? 'Back to dashboard' : 'Back to sign in'
  return (
    <div className="max-w-xl mx-auto py-16">
      <div
        className="bg-surface rounded-2xl border border-border p-8 text-center"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Compass size={32} className="mx-auto text-ink-muted mb-3" />
        <h1
          className="text-2xl font-bold text-ink mb-1"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Page not found
        </h1>
        <p className="text-sm text-ink-secondary mb-6">
          We couldn't find <code className="text-ink">{pathname}</code> — it may
          have been moved or never existed.
        </p>
        <Link
          to={target}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-light transition-colors"
        >
          <ArrowLeft size={14} /> {label}
        </Link>
      </div>
    </div>
  )
}
