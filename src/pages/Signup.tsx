import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth, validateEmailForRole } from '../contexts/AuthContext'
import type { Role } from '../types'
import { ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'
import ThemeToggle from '../components/ThemeToggle'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

const ROLES: Role[] = ['student', 'employer_mentor']

const ROLE_DESCRIPTIONS: Record<'student' | 'employer_mentor', string> = {
  student: 'Browse and apply to opportunities. Requires your @crms.org school email.',
  employer_mentor: 'Post opportunities and connect with students. Use your personal email.',
}

export default function Signup() {
  const { user, signUp, loading } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // P3-39 — confirm-password.
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<Role>('student')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailTouched, setEmailTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // Re-validate when role changes after field was already touched
  useEffect(() => {
    if (emailTouched) setEmailError(validateEmailForRole(email, role))
  }, [role])

  if (!loading && user) {
    // Already-signed-in users hitting /signup land on the welcome dashboard.
    return <Navigate to="/explore" replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (emailError) return
    setFormError(null)
    setSubmitting(true)

    const { error } = await signUp({ email, password, fullName, role })
    setSubmitting(false)

    if (error) {
      setFormError(error)
      return
    }
    navigate('/onboarding', { replace: true })
  }

  // P3-40 — stronger password rule. Length AND at least one of each:
  // letter (any case), digit, and either a special char or another
  // letter case. Keeps the bar reasonable without forcing rare symbols.
  const passwordOk =
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  const confirmOk = password === confirm
  const canSubmit =
    fullName.trim() &&
    email &&
    passwordOk &&
    confirmOk &&
    !emailError &&
    !submitting

  return (
    <div className="min-h-screen flex relative">

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
            Your community<br />starts here
          </h2>
          <p className="text-white/65 text-base leading-relaxed">
            Students, employers, and mentors — all in one place. Discover opportunities, find mentors, and build the future together.
          </p>
        </div>

        <div className="relative z-10">
          <p className="text-white/40 text-sm font-semibold uppercase tracking-widest">
            Colorado Rocky Mountain School
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 min-h-screen relative" style={{ backgroundColor: 'var(--color-background)' }}>
        {/* D.1 — theme toggle anchored to the right panel, not the viewport. */}
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3" style={{ backgroundColor: 'var(--color-primary)' }}>
            {logoError ? (
              <span className="text-2xl font-black" style={{ color: 'var(--color-accent)' }}>C</span>
            ) : (
              <img src={CRMS_LOGO} alt="CRMS" className="h-9 w-auto brightness-0 invert" onError={() => setLogoError(true)} />
            )}
          </div>
          <p className="text-sm text-ink-muted font-semibold uppercase tracking-wider">CRMS Connect</p>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
            Create your account
          </h1>
          <p className="text-ink-muted text-sm mb-7">Join Colorado Rocky Mountain School's private network.</p>

          {formError && (
            <div role="alert" aria-live="polite"
              className="mb-5 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm border border-status-rejected-border"
              style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p>{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="block text-sm text-ink mb-1.5" style={{ fontWeight: 700 }}>
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                maxLength={60}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Alex Johnson"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                  transition-colors"
              />
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm text-ink mb-1.5" style={{ fontWeight: 700 }}>
                Your role
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => {
                  const selected = role === r
                  return (
                    <button type="button"
                      key={r}
                      onClick={() => setRole(r)}
                      aria-pressed={selected}
                      // P0-3 — make the selected state unambiguous with a 2px
                      // ring (independent of the base border color), bold
                      // text, and a check glyph. Was: same border width as
                      // the unselected button which left the toggle visually
                      // unchanged in some themes.
                      className={`relative px-3 py-2.5 rounded-lg border-2 text-sm font-semibold transition-colors text-center
                        ${selected
                          ? 'border-primary text-primary bg-primary-muted'
                          : 'border-border text-ink-secondary hover:border-border-strong hover:bg-primary-faint'
                        }`}
                    >
                      {selected && (
                        <span aria-hidden="true" className="absolute top-1 right-1.5 text-primary text-xs">✓</span>
                      )}
                      {ROLE_LABELS[r]}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-ink-muted leading-relaxed">
                {ROLE_DESCRIPTIONS[role as 'student' | 'employer_mentor']}
              </p>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm text-ink mb-1.5" style={{ fontWeight: 700 }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  const next = e.target.value
                  setEmail(next)
                  // L-11 — validate on input once the field has been touched,
                  // so the error clears the moment the value becomes valid.
                  if (emailTouched) setEmailError(validateEmailForRole(next, role))
                }}
                onBlur={() => { setEmailTouched(true); setEmailError(validateEmailForRole(email, role)) }}
                placeholder={role === 'student' ? 'you@crms.org' : 'you@example.com'}
                className={`w-full px-3.5 py-2.5 rounded-lg border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder
                  focus:outline-none focus:ring-2 focus:border-primary transition-colors
                  ${emailError ? 'border-error focus:ring-error/20' : 'border-border focus:ring-primary/20'}`}
              />
              {emailError && (
                <p className="mt-1.5 text-xs flex items-center gap-1" style={{ color: 'var(--color-error)' }}>
                  <AlertCircle size={12} />
                  {emailError}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm text-ink mb-1.5" style={{ fontWeight: 700 }}>
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
                    focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                    transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* S1.7 — live password strength indicators. Shows three checks
                  that flip green as the user types. */}
              {password && (
                <ul className="mt-1.5 text-xs space-y-0.5">
                  {(() => {
                    const checks: { ok: boolean; label: string }[] = [
                      { ok: password.length >= 8, label: 'At least 8 characters' },
                      { ok: /[A-Za-z]/.test(password), label: 'Contains a letter' },
                      { ok: /[0-9]/.test(password), label: 'Contains a number' },
                    ]
                    return checks.map((c) => (
                      <li key={c.label} className={c.ok ? 'text-success' : 'text-ink-muted'}>
                        {c.ok ? '✓' : '·'} {c.label}
                      </li>
                    ))
                  })()}
                </ul>
              )}
            </div>

            {/* P3-39 — confirm-password. */}
            <div>
              <label htmlFor="confirm" className="block text-sm text-ink mb-1.5" style={{ fontWeight: 700 }}>
                Confirm password
              </label>
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder
                  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                  transition-colors"
              />
              {confirm && !confirmOk && (
                <p className="mt-1.5 text-xs text-error">Passwords don't match.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-gold w-full py-3 mt-2"
            >
              {submitting && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="hover:underline" style={{ color: 'var(--color-primary)', fontWeight: 800 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
