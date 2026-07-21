import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthShell } from './PublicShell'
import { TextField, SelectField } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import type { MemberAffiliation } from '../../types'

const THIS_YEAR = new Date().getFullYear()
const STUDENT_YEARS = [0, 1, 2, 3, 4].map((n) => THIS_YEAR + n)

const AFFILIATIONS: { value: MemberAffiliation; label: string }[] = [
  { value: 'alumni', label: 'Alum' },
  { value: 'parent', label: 'Parent (current or past)' },
  { value: 'faculty_staff', label: 'Faculty or staff (current or past)' },
  { value: 'friend', label: 'Friend of the school' },
]

export function Signup() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [role, setRole] = useState<'student' | 'member'>(params.get('role') === 'member' ? 'member' : 'student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [classYear, setClassYear] = useState('')
  const [affiliation, setAffiliation] = useState<MemberAffiliation>('alumni')
  const [organization, setOrganization] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  const passwordsMatch = password === confirm
  const needsClassYear = role === 'student' || (role === 'member' && affiliation === 'alumni')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!passwordsMatch) {
      setError('Passwords don\'t match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (needsClassYear && !classYear) {
      setError(role === 'student' ? 'Pick your expected graduation year.' : 'Pick your graduation year.')
      return
    }
    setSubmitting(true)
    const { error: err, needsConfirmation } = await signUp({
      email,
      password,
      fullName,
      role,
      affiliation: role === 'member' ? affiliation : undefined,
      classYear: classYear ? Number(classYear) : undefined,
      organization: role === 'member' ? organization : undefined,
      title: role === 'member' ? title : undefined,
    })
    setSubmitting(false)
    if (err) {
      setError(err)
      return
    }
    if (needsConfirmation) {
      setConfirmSent(true)
      return
    }
    navigate('/home', { replace: true })
  }

  if (confirmSent) {
    return (
      <AuthShell title="Check your email">
        <p className="text-sm leading-relaxed text-faint">
          We sent a confirmation link to <span className="font-medium text-ink">{email.trim().toLowerCase()}</span>.
          Click it, then sign in.
          {role === 'member' && ' After that, a CRMS staff member will review your account — you\'ll get a note when you\'re approved.'}
        </p>
        <div className="mt-6">
          <Link to="/login" className="text-sm text-pine hover:underline">Back to sign in</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Join CRMS Connect">
      {/* Role picker — the fork that shapes the whole form. */}
      <div role="radiogroup" aria-label="I am a" className="grid grid-cols-2 gap-2">
        {([
          ['student', 'CRMS student'],
          ['member', 'Alum, parent, or friend'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            onClick={() => setRole(value)}
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
              role === value ? 'border-pine bg-meadow text-pine' : 'border-line-strong bg-card text-faint hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
        <TextField
          label="Full name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={80}
          required
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          hint={role === 'student' ? 'Your @crms.org email gets you in immediately.' : undefined}
          required
        />

        {role === 'student' && (
          <SelectField label="Expected graduation year" value={classYear} onChange={(e) => setClassYear(e.target.value)} required>
            <option value="" disabled>Choose a year…</option>
            {STUDENT_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </SelectField>
        )}

        {role === 'member' && (
          <>
            <SelectField
              label="Your connection to CRMS"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value as MemberAffiliation)}
              hint="Shown next to your name — it's how students know who you are."
              required
            >
              {AFFILIATIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </SelectField>
            {affiliation === 'alumni' && (
              <TextField
                label="Graduation year"
                type="number"
                inputMode="numeric"
                min={1950}
                max={THIS_YEAR}
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                required
              />
            )}
            <TextField
              label="Organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              maxLength={80}
              hint="Optional — where you work or what you run."
            />
            <TextField
              label="Role or title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              hint="Optional"
            />
          </>
        )}

        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
          required
        />
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirm && !passwordsMatch ? 'Passwords don\'t match.' : null}
          required
        />

        {role === 'member' && (
          <p className="rounded-lg bg-meadow px-3.5 py-2.5 text-xs leading-relaxed text-pine">
            New member accounts are reviewed by CRMS staff before they go live —
            that's what makes this board worth posting to.
          </p>
        )}

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={submitting} className="w-full" size="lg">
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-faint">
        Already have an account? <Link to="/login" className="text-pine hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  )
}
