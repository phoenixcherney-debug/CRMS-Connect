import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, RotateCcw, LogOut } from 'lucide-react'
import { differenceInDays, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

const GRACE_DAYS = 30

export default function RecoverAccount() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [recovering, setRecovering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deletedAt = profile?.deleted_at ? parseISO(profile.deleted_at) : null
  const daysElapsed = deletedAt ? differenceInDays(new Date(), deletedAt) : 0
  const daysLeft = Math.max(0, GRACE_DAYS - daysElapsed)
  const expired = daysLeft === 0

  async function handleRecover() {
    setRecovering(true)
    setError(null)
    const { error } = await supabase.rpc('recover_own_account')
    if (error) {
      setError('Something went wrong. Please try again.')
      setRecovering(false)
      return
    }
    await refreshProfile()
    navigate('/explore', { replace: true })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div
        className="w-full max-w-md bg-surface rounded-2xl border border-border overflow-hidden"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        {/* Header band */}
        <div className={`px-8 py-6 ${expired ? 'bg-error' : 'bg-amber-500'}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} className="text-white shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-white leading-snug">
                {expired ? 'Account deletion in progress' : 'Your account is scheduled for deletion'}
              </h1>
              <p className="text-sm text-white/80 mt-0.5">
                {expired
                  ? 'The 30-day recovery window has passed.'
                  : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining to recover.`
                }
              </p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          {expired ? (
            <>
              <p className="text-sm text-ink-secondary leading-relaxed mb-6">
                Your recovery window has expired. Your account data is being permanently removed.
                If you believe this is a mistake, please contact support.
              </p>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-secondary leading-relaxed mb-2">
                You requested to delete your CRMS Connect account. Your data is being held for
                <strong className="text-ink"> {daysLeft} more day{daysLeft !== 1 ? 's' : ''}</strong> before it's permanently removed.
              </p>
              <p className="text-sm text-ink-secondary leading-relaxed mb-6">
                Click <strong className="text-ink">Recover my account</strong> to cancel the deletion and restore full access.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2.5 rounded-lg bg-error-bg border border-red-200 text-sm text-error">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRecover}
                  disabled={recovering}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                    bg-primary hover:bg-primary-light text-white font-medium text-sm
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {recovering
                    ? <Spinner size="sm" className="border-white/30 border-t-white" />
                    : <RotateCcw size={15} />
                  }
                  {recovering ? 'Recovering…' : 'Recover my account'}
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={recovering}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                    border border-border text-sm text-ink-secondary hover:bg-primary-faint
                    transition-colors disabled:opacity-50"
                >
                  <LogOut size={15} /> Sign out and continue with deletion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
