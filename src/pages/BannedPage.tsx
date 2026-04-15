import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

export default function BannedPage() {
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user) { navigate('/login', { replace: true }); return }
    if (profile && !profile.banned_at) { navigate('/explore', { replace: true }); return }
  }, [loading, user, profile, navigate])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-error-bg)' }}
        >
          <ShieldAlert size={32} style={{ color: 'var(--color-error)' }} />
        </div>
        <h1
          className="text-2xl font-bold text-ink mb-3"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Account Suspended
        </h1>
        <p className="text-ink-secondary text-sm leading-relaxed mb-8">
          Your account has been suspended. If you believe this is a mistake,
          please contact a school administrator.
        </p>
        <button
          onClick={handleSignOut}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
