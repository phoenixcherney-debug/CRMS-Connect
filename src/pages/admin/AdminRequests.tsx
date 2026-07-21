import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AdminShell } from './AdminShell'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { timeAgo } from '../../lib/format'
import { REQUEST_STATUS_META } from '../../types'
import type { HandRaise, Offer, PublicProfile } from '../../types'

type Row = HandRaise & {
  offer: Pick<Offer, 'id' | 'title'>
  student: Pick<PublicProfile, 'id' | 'full_name'>
}

/** Every student↔member conversation on the platform, one click from staff eyes.
 *  This page existing is a core trust promise, not an afterthought. */
export function AdminRequests() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('requests')
      .select('*, offer:offers!requests_offer_id_fkey(id, title), student:profiles!requests_student_id_fkey(id, full_name)')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as unknown as Row[])
      })
    return () => { cancelled = true }
  }, [])

  return (
    <AdminShell title="Requests & threads">
      <p className="-mt-2 mb-5 text-sm text-faint">
        Every hand-raise and its full conversation. Open any thread to read it — or step in as staff.
      </p>
      {rows === null ? (
        <Spinner page />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={`/requests/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 hover:bg-meadow/50">
                <span className="text-sm font-medium text-ink">{r.student.full_name}</span>
                <span className="text-sm text-faint">on</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.offer.title}</span>
                <span className="flex items-center gap-3">
                  <Badge tint={REQUEST_STATUS_META[r.status].tint}>{REQUEST_STATUS_META[r.status].label}</Badge>
                  <span className="text-xs text-faint">{timeAgo(r.updated_at)}</span>
                </span>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-faint">No hand-raises yet.</li>}
        </ul>
      )}
    </AdminShell>
  )
}
