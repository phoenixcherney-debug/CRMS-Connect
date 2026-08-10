import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from './PublicShell'
import { TextField } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { friendlyError } from '../../lib/errors'

/** Two modes: request a reset link, or (arriving from that link with a
 *  recovery session) set the new password. */
export function ResetPassword() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'request' | 'update'>(() =>
    window.location.hash.includes('type=recovery') ? 'update' : 'request',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('update')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function requestLink(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitting(false)
    if (err) {
      setError(friendlyError(err))
      return
    }
    setSent(true)
  }

  async function updatePassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSubmitting(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (err) {
      setError(friendlyError(err))
      return
    }
    navigate('/home', { replace: true })
  }

  if (mode === 'update') {
    return (
      <AuthShell title="Set a new password">
        <form onSubmit={updatePassword} className="space-y-4" noValidate>
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint="At least 8 characters."
            required
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={submitting} className="w-full" size="lg">
            Save and sign in
          </Button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset your password">
      {sent ? (
        <p className="text-sm leading-relaxed text-faint">
          If an account exists for <span className="font-medium text-ink">{email.trim().toLowerCase()}</span>,
          a reset link is on its way. Check your inbox.
        </p>
      ) : (
        <form onSubmit={requestLink} className="space-y-4" noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={submitting} className="w-full" size="lg">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-faint">
        <Link to="/login" className="text-pine hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  )
}
