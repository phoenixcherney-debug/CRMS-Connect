import { Link, useNavigate } from 'react-router-dom'
import { Hourglass, Mail, ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * SEC-001 — holding page for newly-signed-up employer/mentor accounts.
 * Their RLS policies block messaging, posting, and applications until
 * staff approves them via /admin/pending-accounts.
 */
export default function AwaitingApproval() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div
        className="bg-surface rounded-2xl border border-border p-8 max-w-lg w-full text-center"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Hourglass size={32} className="mx-auto text-primary mb-3" />
        <h1
          className="text-2xl font-bold text-ink mb-2"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Thanks for signing up
        </h1>
        <p className="text-sm text-ink-secondary leading-relaxed mb-3">
          Your employer/mentor account is awaiting review by school staff.
          You'll be able to post opportunities and message students once
          someone at CRMS approves your account.
        </p>
        <p className="text-sm text-ink-secondary leading-relaxed mb-5">
          You can still update your profile while you wait.
          {profile?.full_name ? ` Welcome, ${profile.full_name.split(' ')[0]}.` : ''}
        </p>
        <div className="flex flex-col gap-2 items-center">
          <a
            href="mailto:registrar@crms.org?subject=CRMS%20Connect%20account%20approval"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary-light"
          >
            <Mail size={14} /> Email the registrar
          </a>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
          >
            <ArrowLeft size={14} /> Edit your profile
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/', { replace: true })
            }}
            className="text-xs text-ink-muted hover:underline mt-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
