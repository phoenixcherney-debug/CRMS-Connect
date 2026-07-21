import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { AdminShell } from './AdminShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { OFFER_KIND_META, OFFER_STATUS_LABEL, affiliationLabel } from '../../types'
import type { Offer, PublicProfile } from '../../types'

type Row = Offer & {
  poster: Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year'>
}

export function AdminOffers() {
  const toast = useToast()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('offers')
      .select('*, poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year)')
      .order('created_at', { ascending: false })
    setRows((data ?? []) as unknown as Row[])
  }, [])

  usePageData(load)

  async function setHidden(o: Row, hide: boolean) {
    setActing(o.id)
    const { error } = await supabase
      .from('offers')
      .update({ hidden_at: hide ? new Date().toISOString() : null })
      .eq('id', o.id)
    setActing(null)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(hide ? 'Unlisted — the poster has been notified.' : 'Back on the board.')
    load()
  }

  return (
    <AdminShell title="Offers">
      {rows === null ? (
        <Spinner page />
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {rows.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
              <Badge tint={OFFER_KIND_META[o.kind].tint}>{OFFER_KIND_META[o.kind].label}</Badge>
              <div className="min-w-0 flex-1">
                <Link to={`/board/${o.id}`} className="block truncate text-sm font-medium text-ink hover:text-pine">
                  {o.title}
                </Link>
                <p className="truncate text-xs text-faint">
                  {o.poster.full_name} · {affiliationLabel(o.poster)} · {timeAgo(o.created_at)}
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
      )}
    </AdminShell>
  )
}
