import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { OFFER_POSTER_JOIN } from '../../lib/joins'
import type { OfferPoster } from '../../lib/joins'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { REQUEST_STATUS_META, OFFER_KIND_META, affiliationLabel, personName } from '../../types'
import type { HandRaise, Offer } from '../../types'
import { timeAgo } from '../../lib/format'
import { friendlyError } from '../../lib/errors'

type Row = HandRaise & {
  // Null-safe: even with the applicant RLS carve-out, treat a missing offer join
  // as a degraded row rather than dereferencing it (blocker fix).
  offer: (Pick<Offer, 'id' | 'title' | 'kind'> & { poster: OfferPoster | null }) | null
}

export function MyRequests() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isActive: () => boolean) => {
    const { data, error: err } = await supabase
      .from('requests')
      .select(`*, offer:offers!requests_offer_id_fkey(id, title, kind, ${OFFER_POSTER_JOIN})`)
      .order('updated_at', { ascending: false })
    if (!isActive()) return
    if (err) { setError(friendlyError(err)); return }
    setError(null)
    setRows((data ?? []) as unknown as Row[])
  }, [])

  usePageData(load)

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl">My requests</h1>
        <div className="mt-6"><EmptyState title="We couldn’t load your requests">{error}</EmptyState></div>
      </div>
    )
  }
  if (rows === null) return <Spinner page />

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">My requests</h1>
      <p className="mt-2 text-sm text-faint">Every door you've knocked on, and where it stands.</p>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="You haven't knocked on a door yet"
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
                    {r.offer && <Badge tint={OFFER_KIND_META[r.offer.kind].tint}>{OFFER_KIND_META[r.offer.kind].label}</Badge>}
                    <Badge tint={REQUEST_STATUS_META[r.status].tint}>{REQUEST_STATUS_META[r.status].student}</Badge>
                    <span className="ml-auto text-xs text-faint">{timeAgo(r.updated_at)}</span>
                  </div>
                  <p className="mt-2.5 font-display text-lg font-semibold leading-snug text-ink">{r.offer?.title ?? 'A removed offer'}</p>
                  <p className="mt-1 text-sm text-faint">
                    {r.offer?.poster ? `${r.offer.poster.full_name} · ${affiliationLabel(r.offer.poster)}` : personName(r.offer?.poster ?? null)}
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
