import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePageData } from '../../lib/usePageData'
import { supabase } from '../../lib/supabase'
import { setOfferHidden } from '../../lib/mutations'
import { OFFER_POSTER_JOIN } from '../../lib/joins'
import type { OfferWithPoster } from '../../lib/joins'
import { PAGE_SIZE } from '../../lib/constants'
import { AdminShell } from './AdminShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { OFFER_KIND_META, OFFER_STATUS_LABEL, affiliationLabel, personName } from '../../types'

type Row = OfferWithPoster

export function AdminOffers() {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const load = useCallback(async (isActive: () => boolean) => {
    const { data, error: err } = await supabase
      .from('offers')
      .select(`*, ${OFFER_POSTER_JOIN}`)
      .order('created_at', { ascending: false })
      .range(0, limit - 1)
    if (!isActive()) return
    if (err) { setError(friendlyError(err)); return }
    setError(null)
    setRows((data ?? []))
  }, [limit])

  usePageData(load)

  const hasMore = (rows?.length ?? 0) === limit

  async function setHidden(o: Row, hide: boolean) {
    setActing(o.id)
    const { error } = await setOfferHidden(o.id, hide)
    setActing(null)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(hide ? 'Unlisted — the poster has been notified.' : 'Back on the board.')
    load(() => true)
  }

  return (
    <AdminShell title="Offers">
      {error ? (
        <EmptyState title="We couldn’t load offers">{error}</EmptyState>
      ) : rows === null ? (
        <Spinner page />
      ) : (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {rows.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
                <Badge tint={OFFER_KIND_META[o.kind].tint}>{OFFER_KIND_META[o.kind].label}</Badge>
                {/* A `flex-1` item has flex-basis:0, so the line never exceeds
                    its container and never wraps — the title just absorbs the
                    whole shortfall and truncates to ~20px at 375px. Give it its
                    own row below `sm`, and only then let it flex. */}
                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                  <Link to={`/board/${o.id}`} className="block truncate text-sm font-medium text-ink hover:text-pine">
                    {o.title}
                  </Link>
                  <p className="truncate text-xs text-faint">
                    {o.poster ? `${o.poster.full_name} · ${affiliationLabel(o.poster)}` : personName(o.poster)} · {timeAgo(o.created_at)}
                  </p>
                </div>
                <span className="flex items-center gap-2">
                  {o.hidden_at ? <Badge tint="bg-clay-soft text-danger">Unlisted</Badge> : <Badge>{OFFER_STATUS_LABEL[o.status]}</Badge>}
                  <Link to={`/offers/${o.id}/manage`} className="text-xs text-pine hover:underline">requests</Link>
                  <Button
                    size="sm"
                    variant={o.hidden_at ? 'secondary' : 'danger'}
                    loading={acting === o.id}
                    onClick={() => setHidden(o, !o.hidden_at)}
                  >
                    {o.hidden_at ? 'Restore' : 'Unlist'}
                  </Button>
                </span>
              </li>
            ))}
            {rows.length === 0 && <li className="px-5 py-8 text-center text-sm text-faint">No offers yet.</li>}
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
