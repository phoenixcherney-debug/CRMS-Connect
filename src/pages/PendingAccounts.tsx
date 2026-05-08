import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, X, ExternalLink } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastProvider'
import type { Profile } from '../types'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

/**
 * SEC-001 — staff approval queue for employer/mentor signups.
 * Admin-only route (gated upstream in App.tsx).
 *
 * Lists `account_status = 'pending'` profiles, oldest first. Approve flips
 * to 'active'; Reject flips to 'disabled'. Both are reversible from
 * /admin/users/:id, which already shows the underlying status.
 */
export default function PendingAccounts() {
  const toast = useToast()
  const [pending, setPending] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, company, industry, bio, mentor_type, mentor_type_other, created_at, account_status')
      .eq('account_status', 'pending')
      .order('created_at', { ascending: true })
    setPending((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: 'active' | 'disabled', name: string) {
    setActingId(id)
    const { error } = await supabase
      .from('profiles')
      .update({ account_status: status })
      .eq('id', id)
    setActingId(null)
    if (error) {
      toast(`Could not update ${name}.`, { kind: 'error' })
      return
    }
    setPending((prev) => prev.filter((p) => p.id !== id))
    toast(status === 'active' ? `Approved ${name}.` : `Rejected ${name}.`)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
          Pending accounts
        </h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${pending.length} employer/mentor account${pending.length === 1 ? '' : 's'} awaiting approval`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No accounts awaiting approval."
          description="New employer/mentor signups will appear here."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((p) => {
            const acting = actingId === p.id
            return (
              <div
                key={p.id}
                className="bg-surface rounded-xl border border-border p-5"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/admin/users/${p.id}`}
                        className="font-semibold text-ink hover:text-primary transition-colors"
                      >
                        {p.full_name}
                      </Link>
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary-faint text-primary font-medium">
                        Pending
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Signed up {format(parseISO(p.created_at), 'MMM d, yyyy')}
                    </p>
                    {(p.company || p.industry) && (
                      <p className="text-sm text-ink-secondary mt-1">
                        {[p.company, p.industry].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {p.bio && (
                      <p className="text-sm text-ink-secondary mt-2 line-clamp-3">{p.bio}</p>
                    )}
                    <Link
                      to={`/admin/users/${p.id}`}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:text-primary-light"
                    >
                      <ExternalLink size={11} /> Open in admin
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setStatus(p.id, 'active', p.full_name)}
                      disabled={acting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-accepted-bg text-status-accepted-text border border-status-accepted-border hover:opacity-80 disabled:opacity-40 transition-opacity"
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(p.id, 'disabled', p.full_name)}
                      disabled={acting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-rejected-bg text-status-rejected-text border border-status-rejected-border hover:opacity-80 disabled:opacity-40 transition-opacity"
                    >
                      <X size={13} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
