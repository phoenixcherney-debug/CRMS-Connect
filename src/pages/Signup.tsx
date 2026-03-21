import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth, validateEmailForRole } from '../contexts/AuthContext'
import type { Role } from '../types'
import { ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

const ROLES: Role[] = ['student', 'alumni', 'parent']

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  student: 'Browse and apply to opportunities. Requires @crms.org email.',
  alumni: 'Post jobs and connect with students. Use your personal email.',
  parent: 'Share opportunities from your network. Use your personal email.',
}

export default function Signup() {
  const { user, signUp, loading } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<Role>('student')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Real-time email domain validation — must be before any early returns
  useEffect(() => {
    setEmailError(validateEmailForRole(email, role))
  }, [email, role])

  // Already logged in
  if (!loading && user?.email_confirmed_at) {
    return <Navigate to="/jobs" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (emailError) return
    setFormError(null)
    setSubmitting(true)

    const { error, needsVerification } = await signUp({ email, password, fullName, role })
    setSubmitting(false)

    if (error) {
      setFormError(error)
    } else if (needsVerification) {
      setSuccess(true)
    } else {
      // Email confirmation is disabled — user is immediately logged in.
      // Navigate to onboarding; ProtectedRoute will redirect if already complete.
      navigate('/onboarding', { replace: true })
    }
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <div
          className="w-full max-w-sm bg-surface rounded-2xl border border-border p-8 text-center"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          <CheckCircle2 size={48} className="mx-auto mb-4 text-primary" />
          <h2 className="text-xl font-semibold text-ink mb-2">Check your inbox</h2>
          <p className="text-sm text-ink-secondary leading-relaxed">
            We sent a verification link to{' '}
            <strong className="text-ink">{email}</strong>. Click the link to
            activate your CRMS Connect account.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-sm font-medium text-primary hover:text-primary-light"
          >
            Back to sign in →
          </Link>
        </div>
      </div>
    )
  }

  const canSubmit =
    fullName.trim() &&
    email &&
    password.length >= 8 &&
    !emailError &&
    !submitting

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* Brand */}
      <div className="mb-8 text-center">
        <img
          src="https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png"
          alt="Colorado Rocky Mountain School"
          className="h-12 w-auto object-contain mx-auto mb-4"
          onError={(e) => {
            const el = e.currentTarget
            el.style.display = 'none'
            const fallback = el.nextElementSibling as HTMLElement | null
            if (fallback) fallback.style.removeProperty('display')
          }}
        />
        <div
          className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-white text-xl font-black mb-3"
          style={{ display: 'none' }}
        >
          C
        </div>
        <h1 className="text-2xl font-bold text-ink">Join CRMS Connect</h1>
        <p className="text-ink-secondary text-sm mt-1">
          Colorado Rocky Mountain School's private network
        </p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm bg-surface rounded-2xl border border-border p-8"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <h2 className="text-lg font-semibold text-ink mb-6">Create your account</h2>

        {formError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-error-bg border border-red-200 px-4 py-3">
            <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
            <p className="text-sm text-error">{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Full Name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-ink mb-1.5">
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Johnson"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                placeholder:text-ink-placeholder
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                transition-colors"
            />
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              I am a…
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-center
                    ${role === r
                      ? 'bg-primary-muted border-primary text-primary'
                      : 'border-border text-ink-secondary hover:border-border-strong hover:bg-primary-faint'
                    }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">
              {ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          {/* Email */}
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
              placeholder={role === 'student' ? 'you@crms.org' : 'you@example.com'}
              className={`w-full px-3.5 py-2.5 rounded-lg border bg-surface text-ink text-sm
                placeholder:text-ink-placeholder
                focus:outline-none focus:ring-2 focus:border-primary transition-colors
                ${emailError
                  ? 'border-error focus:ring-red-200'
                  : 'border-border focus:ring-primary/30'
                }`}
            />
            {emailError && (
              <p className="mt-1.5 text-xs text-error flex items-center gap-1">
                <AlertCircle size={12} />
                {emailError}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
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
              <p className="mt-1.5 text-xs text-ink-muted">
                Password must be at least 8 characters.
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              bg-primary hover:bg-primary-light text-white font-medium text-sm
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors duration-150 mt-2"
          >
            {submitting
              ? <Spinner size="sm" className="border-white/30 border-t-white" />
              : <UserPlus size={16} />
            }
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-secondary">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:text-primary-light">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
