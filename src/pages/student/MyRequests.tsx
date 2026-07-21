import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { REQUEST_STATUS_META, OFFER_KIND_META, affiliationLabel } from '../../types'
import type { HandRaise, Offer, PublicProfile } from '../../types'
import { timeAgo } from '../../lib/format'

type Row = HandRaise & {
  offer: Pick<Offer, 'id' | 'title' | 'kind'> & {
    poster: Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year'>
  }
}

export function MyRequests() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('requests')
      .select('*, offer:offers!requests_offer_id_fkey(id, title, kind, poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year))')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as unknown as Row[])
      })
    return () => { cancelled = true }
  }, [])

  if (rows === null) return <Spinner page />

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">My requests</h1>
      <p className="mt-2 text-sm text-faint">Every hand you've raised, and where it stands.</p>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="You haven't raised your hand yet"
            action={<Link to="/board"><Button variant="accent">Browse the board</Button></Link>}
          >
            Every offer on the board was posted for CRMS students specifically — pick one and
            tell them why you're interested. That's the whole move.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/requests/${r.id}`}
                  className="block rounded-xl border border-line bg-card p-5 hover:border-pine"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tint={OFFER_KIND_META[r.offer.kind].tint}>{OFFER_KIND_META[r.offer.kind].label}</Badge>
                    <Badge tint={REQUEST_STATUS_META[r.status].tint}>{REQUEST_STATUS_META[r.status].student}</Badge>
                    <span className="ml-auto text-xs text-faint">{timeAgo(r.updated_at)}</span>
                  </div>
                  <p className="mt-2.5 font-display text-lg font-semibold leading-snug text-ink">{r.offer.title}</p>
                  <p className="mt-1 text-sm text-faint">
                    {r.offer.poster.full_name} · {affiliationLabel(r.offer.poster)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
