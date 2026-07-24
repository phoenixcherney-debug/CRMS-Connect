import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { AdminShell } from './AdminShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { personName } from '../../types'
import type { Report, PublicProfile } from '../../types'

type Row = Report & { reporter: Pick<PublicProfile, 'id' | 'full_name'> | null }

const REPORTER_JOIN = '*, reporter:profiles!reports_reporter_id_fkey(id, full_name)'
/** How many settled reports to keep on the page. */
const SETTLED_LIMIT = 20
/** Upper bound on the open queue (staff work it down; a huge backlog is itself a signal). */
const OPEN_LIMIT = 100

export function AdminReports() {
  const toast = useToast()
  const [open, setOpen] = useState<Row[] | null>(null)
  const [settled, setSettled] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  /** message-target id → its thread (request) id, resolved for linking. */
  const [messageThreads, setMessageThreads] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async (isActive: () => boolean) => {
    // Two bounded queries instead of downloading every report then slicing.
    const [openRes, settledRes] = await Promise.all([
      supabase.from('reports').select(REPORTER_JOIN).eq('status', 'open').order('created_at', { ascending: false }).limit(OPEN_LIMIT),
      supabase.from('reports').select(REPORTER_JOIN).neq('status', 'open').order('created_at', { ascending: false }).limit(SETTLED_LIMIT),
    ])
    if (!isActive()) return
    if (openRes.error || settledRes.error) { setError(friendlyError(openRes.error ?? settledRes.error)); return }
    setError(null)
    const openRows = (openRes.data ?? []) as unknown as Row[]
    const settledRows = (settledRes.data ?? []) as unknown as Row[]
    setOpen(openRows)
    setSettled(settledRows)

    const messageIds = [...openRows, ...settledRows].filter((r) => r.target === 'message').map((r) => r.target_id)
    if (messageIds.length > 0) {
      const { data: msgs } = await supabase.from('messages').select('id, request_id').in('id', messageIds)
      if (!isActive()) return
      setMessageThreads(Object.fromEntries((msgs ?? []).map((m) => [m.id, m.request_id])))
    }
  }, [])

  usePageData(load)

  async function resolve(r: Row, status: 'resolved' | 'dismissed') {
    setActing(r.id)
    const { error: err } = await supabase.from('reports').update({ status }).eq('id', r.id)
    setActing(null)
    if (err) {
      toast(friendlyError(err), 'error')
      return
    }
    toast(status === 'resolved' ? 'Marked resolved — reporter notified.' : 'Dismissed — reporter notified.')
    load(() => true)
  }

  function targetLink(r: Row): { to: string; label: string } | null {
    if (r.target === 'user') return { to: `/people/${r.target_id}`, label: 'View person' }
    if (r.target === 'offer') return { to: `/board/${r.target_id}`, label: 'View offer' }
    const threadId = messageThreads[r.target_id]
    return threadId ? { to: `/requests/${threadId}`, label: 'View thread' } : null
  }

  if (error) return <AdminShell title="Reports"><EmptyState title="We couldn’t load reports">{error}</EmptyState></AdminShell>
  if (open === null) return <AdminShell title="Reports"><Spinner page /></AdminShell>

  return (
    <AdminShell title="Reports">
      {open.length === 0 ? (
        <Card><p className="text-sm text-faint">No open flags. When anyone flags a person, offer, or message, it lands here.</p></Card>
      ) : (
        <ul className="space-y-3">
          {open.map((r) => {
            const link = targetLink(r)
            return (
              <li key={r.id}>
                <Card padded>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tint="bg-clay-soft text-danger">{r.target}</Badge>
                    <span className="text-sm text-faint">
                      flagged by <span className="font-medium text-ink">{personName(r.reporter)}</span> · {timeAgo(r.created_at)}
                    </span>
                    {link && <Link to={link.to} className="ml-auto text-sm text-pine hover:underline">{link.label}</Link>}
                  </div>
                  <p className="mt-3 whitespace-pre-line rounded-lg bg-paper px-4 py-3 text-sm text-ink">{r.reason}</p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" loading={acting === r.id} onClick={() => resolve(r, 'dismissed')}>
                      Dismiss
                    </Button>
                    <Button size="sm" loading={acting === r.id} onClick={() => resolve(r, 'resolved')}>
                      Mark resolved
                    </Button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {settled.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg">Recently settled</h2>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-card">
            {settled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 px-5 py-3">
                <Badge>{r.status}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-faint">{r.reason}</span>
                <span className="text-xs text-faint">{r.resolved_at ? timeAgo(r.resolved_at) : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AdminShell>
  )
}
