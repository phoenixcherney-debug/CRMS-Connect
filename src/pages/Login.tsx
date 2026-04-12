import { useState } from 'react'
import type React from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

export default function Login() {
  const { user, signIn, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: Location })?.from?.pathname || '/jobs'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [forgotMode, setForgotMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)

  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  if (!loading && user?.email_confirmed_at) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setUnverifiedEmail(null)
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    setSubmitting(false)
    if (err === 'unverified') {
      setUnverifiedEmail(email)
    } else if (err) {
      setError(err)
    } else {
      navigate(from, { replace: true })
    }
  }

  async function handleResend() {
    if (!unverifiedEmail) return
    setResending(true)
    const { error: err } = await supabase.auth.resend({ type: 'signup', email: unverifiedEmail })
    setResending(false)
    if (!err) setResent(true)
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResetError(null)
    setResetSending(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSending(false)
    if (err) setResetError(err.message)
    else setResetSent(true)
  }

  function enterForgotMode() {
    setResetEmail(email)
    setResetSent(false)
    setResetError(null)
    setForgotMode(true)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 80% 20%, rgba(74,124,47,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 20% 80%, rgba(45,80,22,0.5) 0%, transparent 50%),
            linear-gradient(155deg, #2D5016 0%, #3A6B1E 35%, #4A7C2F 65%, #3A6B1E 100%)
          `,
        }}
      >
        <div className="absolute top-[8%] right-[10%] w-44 h-44 rounded-full opacity-[0.12] border border-white/20"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
        <div className="absolute top-[25%] right-[30%] w-24 h-24 rounded-full opacity-[0.09] border border-white/10"
          style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[12%] left-[5%] w-32 h-32 rounded-full opacity-[0.10] border border-white/15"
          style={{ background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />

        <div className="relative z-10">
          {logoError ? (
            <span className="text-white font-black text-2xl tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>CRMS</span>
          ) : (
            <img src={CRMS_LOGO} alt="Colorado Rocky Mountain School" className="h-12 w-auto object-contain brightness-0 invert" onError={() => setLogoError(true)} />
          )}
        </div>

        <div className="relative z-10">
          <div className="w-12 h-1 rounded-full mb-6" style={{ backgroundColor: 'var(--color-accent)' }} />
          <h2 className="text-3xl font-bold text-white leading-tight mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
            Connecting the<br />CRMS Community
          </h2>
          <p className="text-white/65 text-base leading-relaxed">
            Students, employers, and mentors — all in one place. Discover opportunities, find mentors, and build the future together.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-white/40 text-sm font-semibold uppercase tracking-widest">Colorado Rocky Mountain School</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3" style={{ backgroundColor: 'var(--color-primary)' }}>
            {logoError ? (
              <span className="text-2xl font-black" style={{ color: 'var(--color-accent)', fontWeight: 800 }}>C</span>
            ) : (
              <img src={CRMS_LOGO} alt="CRMS" className="h-9 w-auto brightness-0 invert" onError={() => setLogoError(true)} />
            )}
          </div>
          <p className="text-sm text-ink-muted font-semibold uppercase tracking-wider">CRMS Connect</p>
        </div>

        <div className="w-full max-w-sm">
          {forgotMode ? (
            <>
              <button onClick={() => setForgotMode(false)} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-6 font-semibold">
                <ArrowLeft size={14} /> Back to sign in
              </button>
              <h1 className="text-2xl font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-serif)' }}>Reset password</h1>
              <p className="text-ink-muted text-sm mb-7">Enter your email and we'll send you a reset link.</p>

              {resetSent ? (
                <div className="rounded-lg px-4 py-4 text-sm" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                  <p className="font-bold mb-0.5">Check your inbox</p>
                  <p className="opacity-80">Reset link sent to <strong>{resetEmail}</strong>.</p>
                </div>
              ) : (
                <>
                  {resetError && (
                    <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                      {resetError}
                    </div>
                  )}
                  <form onSubmit={handleForgotSubmit} className="space-y-4" noValidate>
                    <div>
                      <label htmlFor="reset-email" className="block text-sm text-ink mb-1.5" style={{ fontWeight: 700 }}>Email address</label>
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
                          focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      />
                    </div>
                    <button type="submit" disabled={resetSending || !resetEmail.trim()} className="btn-gold w-full py-3">
                      {resetSending && <Spinner size="sm" className="border-white/30 border-t-white" />}
                      {resetSending ? 'Sending…' : 'Send reset link'}
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-serif)' }}>Welcome back</h1>
              <p className="text-ink-muted text-sm mb-7">Sign in to your CRMS Connect account.</p>

              {/* Unverified email notice */}
              {unverifiedEmail && (
                <div className="mb-5 rounded-lg px-4 py-4 text-sm border" style={{ backgroundColor: 'var(--color-primary-muted)', borderColor: 'var(--color-primary)' }}>
                  <p className="font-semibold text-ink mb-1">Please verify your email before logging in.</p>
                  <p className="text-ink-secondary text-xs mb-3">
                    Check your inbox for a confirmation link sent to <strong>{unverifiedEmail}</strong>.
                  </p>
                  {resent ? (
                    <p className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>Verification email resent! Check your inbox.</p>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={resending}
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-light"
                    >
                      {resending ? <Spinner size="sm" /> : <RefreshCw size={12} />}
                      {resending ? 'Resending…' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-5 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm text-ink mb-1.5" style={{ fontWeight: 700 }}>Email address</label>
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
                      focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm text-ink" style={{ fontWeight: 700 }}>Password</label>
                    <button type="button" onClick={enterForgotMode} className="text-xs hover:underline" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
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
                        focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                    />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary" tabIndex={-1}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={submitting || !email || !password} className="btn-gold w-full py-3 mt-2">
                  {submitting && <Spinner size="sm" className="border-white/30 border-t-white" />}
                  {submitting ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-ink-muted">
                Don't have an account?{' '}
                <Link to="/signup" className="hover:underline" style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
                  Create one
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
