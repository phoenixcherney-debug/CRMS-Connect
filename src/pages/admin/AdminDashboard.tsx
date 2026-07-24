import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { setAccountStatus } from '../../lib/mutations'
import { AdminShell } from './AdminShell'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PersonLink } from '../../components/PersonLink'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import type { Profile } from '../../types'

interface Overview {
  pending_members: number
  open_reports: number
  open_offers: number
  hidden_offers: number
  active_students: number
  active_members: number
  requests_30d: number
  accepted_total: number
}

export function AdminDashboard() {
  const toast = useToast()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [pending, setPending] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async (isActive: () => boolean) => {
    const [ovRes, pendingRes] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.from('profiles').select('*').eq('account_status', 'pending').order('created_at', { ascending: true }),
    ])
    if (!isActive()) return
    // Surface a failed overview/queue load instead of spinning forever (review C-03).
    if (ovRes.error || pendingRes.error) {
      setError(friendlyError(ovRes.error ?? pendingRes.error))
      return
    }
    setError(null)
    setOverview(ovRes.data as unknown as Overview)
    setPending(pendingRes.data ?? [])
  }, [])

  usePageData(load)

  async function approve(id: string) {
    setActing(id)
    const { error: err } = await setAccountStatus(id, 'active')
    setActing(null)
    if (err) {
      toast(friendlyError(err), 'error')
      return
    }
    toast('Approved — they\'ve been notified.')
    load(() => true)
  }

  if (error) {
    return (
      <AdminShell title="Overview">
        <EmptyState title="We couldn’t load the overview" action={<Button onClick={() => load(() => true)}>Try again</Button>}>
          {error}
        </EmptyState>
      </AdminShell>
    )
  }
  if (!overview || pending === null) {
    return <AdminShell title="Overview"><Spinner page /></AdminShell>
  }

  const stats: [number, string, string?][] = [
    [overview.pending_members, 'waiting for approval', '/admin/people'],
    [overview.open_reports, 'open reports', '/admin/reports'],
    [overview.open_offers, 'doors on the board', '/admin/offers'],
    [overview.requests_30d, 'knocks in 30 days', '/admin/requests'],
    [overview.active_students, 'active students'],
    [overview.active_members, 'approved members'],
    [overview.accepted_total, 'connections made'],
    [overview.hidden_offers, 'unlisted offers', '/admin/offers'],
  ]

  return (
    <AdminShell title="Overview">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([n, label, link]) => {
          const inner = (
            <>
              <dd className="font-display text-2xl font-semibold text-pine">{n}</dd>
              <dt className="mt-0.5 text-xs text-faint">{label}</dt>
            </>
          )
          return link ? (
            <Link key={label} to={link} className="rounded-xl border border-line bg-card px-4 py-3 hover:border-pine">
              {inner}
            </Link>
          ) : (
            <div key={label} className="rounded-xl border border-line bg-card px-4 py-3">{inner}</div>
          )
        })}
      </dl>

      <section className="mt-8">
        <h2 className="text-xl">Approval queue</h2>
        <p className="mt-1 text-sm text-faint">
          You're the moat: every adult you approve is someone the community trusts on your word.
        </p>
        <div className="mt-4">
          {pending.length === 0 ? (
            <Card><p className="text-sm text-faint">Queue's clear. New signups land here.</p></Card>
          ) : (
            <ul className="space-y-2">
              {pending.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-5 py-3.5">
                  <PersonLink person={p} size="sm" sub={[p.title, p.organization].filter(Boolean).join(', ') || null} />
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-faint">{timeAgo(p.created_at)}</span>
                    <Button size="sm" loading={acting === p.id} onClick={() => approve(p.id)}>Approve</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminShell>
  )
}
