import { useState, useEffect } from 'react'
import type React from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

type PageState = 'verifying' | 'ready' | 'invalid' | 'success'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [pageState, setPageState] = useState<PageState>('verifying')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // FIX: check getSession() immediately on mount — the PASSWORD_RECOVERY event
    // may have already fired (processed by AuthContext) before this component mounted.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPageState('ready')
    })

    // Also listen in case we mount before Supabase processes the token
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPageState('ready')
      }
    })

    // FIX: if no session appears within 8 seconds, the link is expired/invalid
    const timer = setTimeout(() => {
      setPageState((s) => (s === 'verifying' ? 'invalid' : s))
    }, 8000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError(null)
    setSubmitting(true)

    try {
      // Re-verify the session is still alive before attempting the update
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setSubmitting(false)
        setError('Your reset session has expired. Please request a new reset link.')
        setPageState('invalid')
        return
      }

      const { error: err } = await supabase.auth.updateUser({ password })
      setSubmitting(false)

      if (err) {
        setError(err.message)
        return
      }

      setPageState('success')
      // Sign out so they log back in cleanly with the new password
      setTimeout(async () => {
        await supabase.auth.signOut()
        navigate('/login')
      }, 2500)
    } catch (ex) {
      setSubmitting(false)
      setError(
        ex instanceof Error
          ? ex.message
          : 'Something went wrong. Please request a new reset link.'
      )
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* Brand */}
      <div className="mb-8 text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 mx-auto"
          style={{
            background: 'linear-gradient(140deg, #162d08 0%, #2D5016 60%, #3d6b20 100%)',
            boxShadow: '0 8px 24px rgba(45,80,22,0.35)',
          }}
        >
          <img
            src="https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png"
            alt="CRMS"
            className="h-9 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
          <span className="text-white text-2xl font-black" style={{ display: 'none' }}>C</span>
        </div>
        <h1 className="text-2xl font-extrabold text-ink">CRMS Connect</h1>
      </div>

      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-border p-8"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        {/* Success */}
        {pageState === 'success' && (
          <div className="text-center">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-success" />
            <h2 className="text-lg font-semibold text-ink mb-2">Password updated!</h2>
            <p className="text-sm text-ink-secondary">
              Redirecting you to sign in with your new password…
            </p>
          </div>
        )}

        {/* Verifying */}
        {pageState === 'verifying' && (
          <div className="text-center py-4">
            <Spinner size="lg" className="mx-auto mb-3" />
            <p className="text-sm text-ink-secondary">Verifying your reset link…</p>
          </div>
        )}

        {/* Invalid / expired link */}
        {pageState === 'invalid' && (
          <div className="text-center">
            <AlertCircle size={40} className="mx-auto mb-4 text-error" />
            <h2 className="text-lg font-semibold text-ink mb-2">Link expired or invalid</h2>
            <p className="text-sm text-ink-secondary mb-6 leading-relaxed">
              This reset link has expired or has already been used. Please request a new one.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-light
                text-white font-medium text-sm transition-colors"
            >
              Back to sign in
            </button>
          </div>
        )}

        {/* Password form */}
        {pageState === 'ready' && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center shrink-0">
                <KeyRound size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Set a new password</h2>
                <p className="text-xs text-ink-secondary">Choose something you haven't used before</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-error-bg border border-red-200 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-ink mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                      transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && password.length < 8 && (
                  <p className="mt-1.5 text-xs text-ink-muted">Password must be at least 8 characters.</p>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-ink mb-1.5">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter your password"
                  className={`w-full px-3.5 py-2.5 rounded-lg border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder
                    focus:outline-none focus:ring-2 focus:border-primary transition-colors
                    ${confirm && confirm !== password
                      ? 'border-error focus:ring-red-200'
                      : 'border-border focus:ring-primary/30'
                    }`}
                />
                {confirm && confirm !== password && (
                  <p className="mt-1.5 text-xs text-error">Passwords do not match.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || password.length < 8 || password !== confirm}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-primary hover:bg-primary-light text-white font-medium text-sm
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {submitting
                  ? <Spinner size="sm" className="border-white/30 border-t-white" />
                  : <KeyRound size={15} />
                }
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
