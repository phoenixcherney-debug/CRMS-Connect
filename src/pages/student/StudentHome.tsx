import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { OfferCard } from '../../components/OfferCard'
import type { OfferWithPoster } from '../../components/OfferCard'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { REQUEST_STATUS_META } from '../../types'
import type { HandRaise, Offer } from '../../types'
import { timeAgo } from '../../lib/format'
import { friendlyError } from '../../lib/errors'

type RequestWithOffer = HandRaise & { offer: Pick<Offer, 'id' | 'title' | 'kind'> }

export function StudentHome() {
  const { profile } = useAuth()
  const [fresh, setFresh] = useState<OfferWithPoster[] | null>(null)
  const [active, setActive] = useState<RequestWithOffer[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [offersRes, requestsRes] = await Promise.all([
        supabase
          .from('offers')
          .select('*, poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year, organization)')
          .eq('status', 'open')
          .is('hidden_at', null)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('requests')
          .select('*, offer:offers!requests_offer_id_fkey(id, title, kind)')
          .in('status', ['sent', 'in_conversation', 'accepted'])
          .order('updated_at', { ascending: false })
          .limit(5),
      ])
      if (cancelled) return
      if (offersRes.error || requestsRes.error) {
        setError(friendlyError(offersRes.error ?? requestsRes.error))
        return
      }
      setFresh((offersRes.data ?? []) as unknown as OfferWithPoster[])
      setActive((requestsRes.data ?? []) as unknown as RequestWithOffer[])
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (!profile) return null
  const firstName = profile.full_name.split(' ')[0]

  return (
    <div>
      <h1 className="text-3xl">Hey, {firstName}</h1>
      <p className="mt-2 max-w-xl text-sm text-faint">
        Alumni and parents post doors here they'd never post publicly. Your job is just to raise a hand.
      </p>

      {error ? (
        <div className="mt-8"><EmptyState title="We couldn’t load your home">{error}</EmptyState></div>
      ) : active === null || fresh === null ? (
        <Spinner page />
      ) : (
        <>
          {active.length > 0 && (
            <section className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl">Your hand-raises</h2>
                <Link to="/requests" className="text-sm text-pine hover:underline">All of them</Link>
              </div>
              <div className="mt-4 space-y-2">
                {active.map((r) => (
                  <Link
                    key={r.id}
                    to={`/requests/${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-card px-5 py-3.5 hover:border-pine"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{r.offer.title}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge tint={REQUEST_STATUS_META[r.status].tint}>{REQUEST_STATUS_META[r.status].student}</Badge>
                      <span className="hidden text-xs text-faint sm:inline">{timeAgo(r.updated_at)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl">Fresh on the board</h2>
              <Link to="/board" className="text-sm text-pine hover:underline">The whole board</Link>
            </div>
            {fresh.length === 0 ? (
              <Card className="mt-4">
                <p className="text-sm text-faint">The board is quiet right now — new doors open all the time. Check back soon.</p>
              </Card>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {fresh.map((o) => <OfferCard key={o.id} offer={o} />)}
              </div>
            )}
          </section>

          {active.length === 0 && (
            <Card className="mt-8 border-clay/25 bg-clay-soft/50">
              <p className="text-sm leading-relaxed text-clay-deep">
                You haven't raised your hand yet. Every offer on the board was posted for CRMS students
                specifically — the person behind it <em>wants</em> to hear from you. Pick one.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
