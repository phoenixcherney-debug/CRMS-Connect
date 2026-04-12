import { useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { Mail, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

export default function VerifyEmail() {
  const location = useLocation()
  const stateEmail = (location.state as { email?: string })?.email ?? ''
  const [emailInput, setEmailInput] = useState(stateEmail)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)

  const email = stateEmail || emailInput.trim()

  async function handleResend() {
    if (!email) return
    setResending(true)
    setResendError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (error) {
      setResendError(error.message)
    } else {
      setResent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          {logoError ? (
            <span className="font-black text-2xl" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-serif)' }}>CRMS</span>
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-2" style={{ backgroundColor: 'var(--color-primary)' }}>
              <img src={CRMS_LOGO} alt="CRMS" className="h-9 w-auto brightness-0 invert" onError={() => setLogoError(true)} />
            </div>
          )}
        </div>

        <div
          className="bg-surface rounded-2xl border border-border p-8"
          style={{ boxShadow: 'var(--shadow-modal)' }}
        >
          <div
            className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-primary-muted)' }}
          >
            <Mail size={26} style={{ color: 'var(--color-primary)' }} />
          </div>

          <h2 className="text-xl font-bold text-ink mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
            Check your email
          </h2>
          <p className="text-sm text-ink-secondary leading-relaxed mb-4">
            {stateEmail
              ? <>We sent a confirmation link to <strong className="text-ink">{stateEmail}</strong>. Click the link in that email to activate your account.</>
              : 'Enter your email address below to resend a confirmation link.'
            }
          </p>

          {!stateEmail && (
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                placeholder:text-ink-placeholder
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                transition-colors mb-4"
            />
          )}

          {resent ? (
            <div
              className="rounded-lg px-4 py-3 text-sm mb-4"
              style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}
            >
              Verification email resent. Check your inbox (and spam folder).
            </div>
          ) : (
            <>
              {resendError && (
                <div
                  className="rounded-lg px-4 py-3 text-sm mb-4"
                  style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}
                >
                  {resendError}
                </div>
              )}
              <button
                onClick={handleResend}
                disabled={resending || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border
                  text-sm font-medium text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed mb-4"
              >
                {resending ? <Spinner size="sm" /> : <RefreshCw size={14} />}
                {resending ? 'Resending…' : 'Resend verification email'}
              </button>
            </>
          )}

          <Link
            to="/login"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            Back to sign in →
          </Link>
        </div>
      </div>
    </div>
  )
}
