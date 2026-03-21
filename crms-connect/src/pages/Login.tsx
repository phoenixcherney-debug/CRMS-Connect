import { useState } from 'react'
import type React from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

export default function Login() {
  const { user, signIn, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname || '/explore'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Forgot password state
  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  // Already logged in
  if (!loading && user?.email_confirmed_at) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    setSubmitting(false)
    if (err) {
      setError(err)
    } else {
      navigate(from, { replace: true })
    }
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResetError(null)
    setResetSending(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSending(false)
    if (err) {
      setResetError(err.message)
    } else {
      setResetSent(true)
    }
  }

  function enterForgotMode() {
    setResetEmail(email) // pre-fill with whatever they typed
    setResetSent(false)
    setResetError(null)
    setForgotMode(true)
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
          style={{ background: 'linear-gradient(140deg, #162d08 0%, #2D5016 60%, #3d6b20 100%)', boxShadow: '0 8px 24px rgba(45,80,22,0.35)' }}
        >
          <img
            src="https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png"
            alt="Colorado Rocky Mountain School"
            className="h-9 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
            onError={(e) => {
              const el = e.currentTarget
              el.style.display = 'none'
              const fallback = el.nextElementSibling as HTMLElement | null
              if (fallback) fallback.style.removeProperty('display')
            }}
          />
          <span className="text-white text-2xl font-black" style={{ display: 'none' }}>C</span>
        </div>
        <h1 className="text-2xl font-extrabold text-ink">CRMS Connect</h1>
        <p className="text-ink-secondary text-sm mt-1">
          Sign in to explore opportunities
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-border p-8"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        {forgotMode ? (
          /* ── Forgot password view ── */
          <>
            <button
              onClick={() => setForgotMode(false)}
              className="flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-5 -ml-1"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </button>

            <h2 className="text-lg font-semibold text-ink mb-1">Reset your password</h2>
            <p className="text-sm text-ink-secondary mb-6">
              Enter your email and we'll send you a link to set a new password.
            </p>

            {resetSent ? (
              <div className="rounded-lg bg-success-bg border border-green-200 px-4 py-4 text-sm text-success">
                <p className="font-medium mb-0.5">Check your inbox</p>
                <p className="text-success/80">
                  We sent a reset link to <strong>{resetEmail}</strong>. It may take a moment to arrive.
                </p>
              </div>
            ) : (
              <>
                {resetError && (
                  <div className="mb-4 rounded-lg bg-error-bg border border-red-200 px-4 py-3 text-sm text-error">
                    {resetError}
                  </div>
                )}
                <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium text-ink mb-1.5">
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                        placeholder:text-ink-placeholder
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                        transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetSending || !resetEmail.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                      bg-primary hover:bg-primary-light text-white font-medium text-sm
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resetSending && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    {resetSending ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              </>
            )}
          </>
        ) : (
          /* ── Sign in view ── */
          <>
            <h2 className="text-lg font-semibold text-ink mb-6">Welcome back</h2>

            {error && (
              <div className="mb-5 rounded-lg bg-error-bg border border-red-200 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-ink">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={enterForgotMode}
                    className="text-xs text-primary hover:text-primary-light font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
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
              </div>

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-primary hover:bg-primary-light text-white font-medium text-sm
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-150 mt-2"
              >
                {submitting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <LogIn size={16} />}
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-ink-secondary">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-primary hover:text-primary-light">
                Create one
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
