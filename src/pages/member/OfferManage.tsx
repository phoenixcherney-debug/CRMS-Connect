import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { useAuth } from '../../contexts/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { PersonLink } from '../../components/PersonLink'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { OFFER_KIND_META, OFFER_STATUS_LABEL, REQUEST_STATUS_META } from '../../types'
import type { HandRaise, Offer, PublicProfile } from '../../types'
import { useToast } from '../../components/ui/Toast'
import { pluralize } from '../../lib/pluralize'

type RequestRow = HandRaise & {
  student: Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year' | 'tags'> | null
}

/** The poster's view of one offer: every hand raised, and what happened next. */
export function OfferManage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const toast = useToast()
  const [offer, setOffer] = useState<Offer | null>(null)
  const [rows, setRows] = useState<RequestRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase.from('offers').select('*').eq('id', id).maybeSingle()
    if (error || !data) {
      setLoadError(error ? friendlyError(error) : 'This offer doesn\'t exist or isn\'t yours to manage.')
      return
    }
    setOffer(data)
    const { data: reqs } = await supabase
      .from('requests')
      .select('*, student:profiles!requests_student_id_fkey(id, full_name, role, affiliation, class_year, tags)')
      .eq('offer_id', id)
      .order('created_at', { ascending: false })
    setRows((reqs ?? []) as unknown as RequestRow[])
  }, [id])

  usePageData(load)

  if (loadError) {
    return (
      <Card className="text-center">
        <p className="text-sm text-faint">{loadError}</p>
        <Link to="/home" className="mt-4 inline-block text-sm text-pine hover:underline">My offers</Link>
      </Card>
    )
  }
  if (!offer || rows === null || !profile) return <Spinner page />

  const isOwner = offer.posted_by === profile.id
  const accepted = rows.filter((r) => r.status === 'accepted').length
  const waiting = rows.filter((r) => r.status === 'sent' || r.status === 'in_conversation').length

  async function setStatus(status: Offer['status']) {
    if (!offer) return
    setClosing(true)
    const { error } = await supabase.from('offers').update({ status }).eq('id', offer.id)
    setClosing(false)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(status === 'closed' ? 'Door closed.' : 'Door reopened.')
    load()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={isOwner ? '/home' : '/admin/offers'} className="text-sm text-faint hover:text-ink">
        ← {isOwner ? 'My offers' : 'All offers'}
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tint={OFFER_KIND_META[offer.kind].tint}>{OFFER_KIND_META[offer.kind].label}</Badge>
        <Badge>{OFFER_STATUS_LABEL[offer.status]}</Badge>
        {offer.hidden_at && <Badge tint="bg-clay-soft text-clay-deep">Unlisted by staff</Badge>}
      </div>
      <h1 className="mt-3 text-3xl leading-tight">{offer.title}</h1>
      <p className="mt-2 text-sm text-faint">
        {pluralize(accepted, 'spot')} filled of {offer.spots} · {pluralize(waiting, 'hand')} in the air
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to={`/board/${offer.id}`}><Button variant="secondary" size="sm">View on the board</Button></Link>
        {isOwner && !offer.hidden_at && (
          <>
            <Link to={`/offers/${offer.id}/edit`}><Button variant="ghost" size="sm">Edit</Button></Link>
            {offer.status === 'open' || offer.status === 'filled' ? (
              <Button variant="ghost" size="sm" loading={closing} onClick={() => setStatus('closed')}>
                Close this door
              </Button>
            ) : offer.status === 'closed' ? (
              <Button variant="ghost" size="sm" loading={closing} onClick={() => setStatus('open')}>
                Reopen
              </Button>
            ) : null}
          </>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-xl">Hands raised</h2>
        <div className="mt-4">
          {rows.length === 0 ? (
            <EmptyState title="No hands yet">
              Students see new offers within a day. When someone raises a hand,
              you'll get a notification and their note lands here.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id}>
                  <Card padded>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <PersonLink person={r.student} size="sm" />
                      <div className="flex items-center gap-3">
                        <Badge tint={REQUEST_STATUS_META[r.status].tint}>{REQUEST_STATUS_META[r.status].label}</Badge>
                        <span className="text-xs text-faint">{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-line rounded-lg bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
                      {r.note}
                    </p>
                    {r.student && r.student.tags.length > 0 && (
                      <p className="mt-3 text-xs text-faint">Into: {r.student.tags.join(', ')}</p>
                    )}
                    <div className="mt-4 flex justify-end">
                      <Link to={`/requests/${r.id}`}>
                        <Button size="sm" variant={r.status === 'sent' ? 'primary' : 'secondary'}>
                          {r.status === 'sent' ? 'Reply' : 'Open thread'}
                        </Button>
                      </Link>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
