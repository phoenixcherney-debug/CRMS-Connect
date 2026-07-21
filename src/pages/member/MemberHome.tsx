import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { OFFER_KIND_META, OFFER_STATUS_LABEL, REQUEST_STATUS_META, affiliationLabel } from '../../types'
import type { HandRaise, Offer, PublicProfile } from '../../types'
import { timeAgo } from '../../lib/format'
import { pluralize } from '../../lib/pluralize'

type IncomingRow = HandRaise & {
  offer: Pick<Offer, 'id' | 'title'>
  student: Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year'>
}

export function MemberHome() {
  const { profile } = useAuth()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [incoming, setIncoming] = useState<IncomingRow[] | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    async function load() {
      const [offersRes, incomingRes] = await Promise.all([
        supabase
          .from('offers')
          .select('*')
          .eq('posted_by', profile!.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('requests')
          .select('*, offer:offers!requests_offer_id_fkey!inner(id, title, posted_by), student:profiles!requests_student_id_fkey(id, full_name, role, affiliation, class_year)')
          .eq('offer.posted_by', profile!.id)
          .in('status', ['sent', 'in_conversation'])
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      setOffers(offersRes.data ?? [])
      setIncoming((incomingRes.data ?? []) as unknown as IncomingRow[])
    }
    load()
    return () => { cancelled = true }
  }, [profile])

  if (!profile) return null
  const firstName = profile.full_name.split(' ')[0]

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Hey, {firstName}</h1>
          <p className="mt-2 max-w-xl text-sm text-faint">
            Every door you open here goes only to CRMS students — never the open internet.
          </p>
        </div>
        <Link to="/offers/new">
          <Button variant="accent" size="lg">Open a door</Button>
        </Link>
      </div>

      {offers === null || incoming === null ? (
        <Spinner page />
      ) : (
        <>
          {incoming.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl">Hands in the air</h2>
              <p className="mt-1 text-sm text-faint">
                {pluralize(incoming.length, 'student is', 'students are')} waiting to hear from you.
              </p>
              <div className="mt-4 space-y-2">
                {incoming.map((r) => (
                  <Link
                    key={r.id}
                    to={`/requests/${r.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-card px-5 py-3.5 hover:border-pine"
                  >
                    <span className="text-sm font-medium text-ink">{r.student.full_name}</span>
                    <span className="text-xs text-faint">{affiliationLabel(r.student)}</span>
                    <span className="text-sm text-faint">· {r.offer.title}</span>
                    <span className="ml-auto flex items-center gap-3">
                      <Badge tint={REQUEST_STATUS_META[r.status].tint}>{REQUEST_STATUS_META[r.status].label}</Badge>
                      <span className="hidden text-xs text-faint sm:inline">{timeAgo(r.created_at)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-xl">Your offers</h2>
            {offers.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="You haven't opened a door yet"
                  action={<Link to="/offers/new"><Button variant="accent">Open your first door</Button></Link>}
                >
                  It takes two minutes, and it can be small: one shadow day, one phone call,
                  one afternoon of advice. The smallest doors change the most.
                </EmptyState>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {offers.map((o) => (
                  <Link
                    key={o.id}
                    to={`/offers/${o.id}/manage`}
                    className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-card px-5 py-3.5 hover:border-pine"
                  >
                    <Badge tint={OFFER_KIND_META[o.kind].tint}>{OFFER_KIND_META[o.kind].label}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{o.title}</span>
                    {o.hidden_at ? (
                      <Badge tint="bg-clay-soft text-clay-deep">Unlisted by staff</Badge>
                    ) : (
                      <Badge>{OFFER_STATUS_LABEL[o.status]}</Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {!profile.open_to_requests && (
            <Card className="mt-8 border-clay/25 bg-clay-soft/50">
              <p className="text-sm text-clay-deep">
                You're paused — students can't raise a hand on your offers right now.{' '}
                <Link to="/profile" className="font-medium underline">Unpause in your profile</Link> when you're ready.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
