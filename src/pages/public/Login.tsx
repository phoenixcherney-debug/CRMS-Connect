import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthShell } from './PublicShell'
import { TextField } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import { friendlyError } from '../../lib/errors'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    setSubmitting(false)
    if (err) {
      setError(friendlyError(err))
      return
    }
    const from = (location.state as { from?: string } | null)?.from
    navigate(from && from !== '/login' ? from : '/home', { replace: true })
  }

  return (
    <AuthShell title="Welcome back">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full" size="lg">
          Sign in
        </Button>
      </form>
      <div className="mt-6 space-y-2 text-center text-sm text-faint">
        <p>
          <Link to="/reset-password" className="text-pine hover:underline">Forgot your password?</Link>
        </p>
        <p>
          New here? <Link to="/signup" className="text-pine hover:underline">Join CRMS Connect</Link>
        </p>
      </div>
    </AuthShell>
  )
}
