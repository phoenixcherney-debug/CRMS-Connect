import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { PAGE_SIZE } from '../../lib/constants'
import { AdminShell } from './AdminShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { REQUEST_STATUS_META, personName } from '../../types'
import type { HandRaise, Offer, PublicProfile } from '../../types'

type Row = HandRaise & {
  offer: Pick<Offer, 'id' | 'title'> | null
  student: Pick<PublicProfile, 'id' | 'full_name'> | null
}

/** Every student↔member conversation on the platform, one click from staff eyes.
 *  This page existing is a core trust promise, not an afterthought. */
export function AdminRequests() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const load = useCallback(async (isActive: () => boolean) => {
    const { data, error: err } = await supabase
      .from('requests')
      .select('*, offer:offers!requests_offer_id_fkey(id, title), student:profiles!requests_student_id_fkey(id, full_name)')
      .order('updated_at', { ascending: false })
      .range(0, limit - 1)
    if (!isActive()) return
    if (err) { setError(friendlyError(err)); return }
    setError(null)
    setRows((data ?? []))
  }, [limit])

  usePageData(load)

  const hasMore = (rows?.length ?? 0) === limit

  return (
    <AdminShell title="Requests & threads">
      <p className="-mt-2 mb-5 text-sm text-faint">
        Every knock and its full conversation. Open any thread to read it — or step in as staff.
      </p>
      {error ? (
        <EmptyState title="We couldn’t load requests">{error}</EmptyState>
      ) : rows === null ? (
        <Spinner page />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {rows.map((r) => (
              <li key={r.id}>
                <Link to={`/requests/${r.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 hover:bg-meadow/50">
                  <span className="text-sm font-medium text-ink">{personName(r.student)}</span>
                  <span className="text-sm text-faint">on</span>
                  {/* flex-basis:0 means this never triggers wrapping and instead
                      absorbs the entire shortfall; claim a full row below `sm`. */}
                  <span className="w-full min-w-0 truncate text-sm text-ink sm:w-auto sm:flex-1">
                    {r.offer?.title ?? 'a removed offer'}
                  </span>
                  <span className="flex items-center gap-3">
                    <Badge tint={REQUEST_STATUS_META[r.status].tint}>{REQUEST_STATUS_META[r.status].label}</Badge>
                    <span className="text-xs text-faint">{timeAgo(r.updated_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
            {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-faint">No knocks yet.</li>}
          </ul>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE_SIZE)}>Load more</Button>
            </div>
          )}
        </>
      )}
    </AdminShell>
  )
}
