import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { friendlyError } from '../../lib/errors'
import { OfferCard } from '../../components/OfferCard'
import type { OfferWithPoster } from '../../components/OfferCard'
import { ReportButton } from '../../components/ReportButton'
import { affiliationLabel, PUBLIC_PROFILE_COLUMNS } from '../../types'
import type { PublicProfile } from '../../types'

/** Read-only profile. Contact info is never shown — contact happens in threads. */
export function PersonProfile() {
  const { id } = useParams<{ id: string }>()
  const { profile: me } = useAuth()
  const [person, setPerson] = useState<PublicProfile | null>(null)
  const [offers, setOffers] = useState<OfferWithPoster[] | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase.from('profiles').select(PUBLIC_PROFILE_COLUMNS).eq('id', id!).maybeSingle()
      if (cancelled) return
      if (err) { setError(friendlyError(err)); return }
      if (!data) {
        setMissing(true)
        return
      }
      setPerson(data as PublicProfile)
      if (data.role === 'member') {
        const { data: theirOffers } = await supabase
          .from('offers')
          .select('*, poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year, organization)')
          .eq('posted_by', id!)
          .eq('status', 'open')
          .is('hidden_at', null)
          .order('created_at', { ascending: false })
        if (!cancelled) setOffers((theirOffers ?? []) as unknown as OfferWithPoster[])
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  if (error) {
    return <EmptyState title="We couldn’t load this profile">{error}</EmptyState>
  }
  if (missing) {
    return (
      <EmptyState title="No one here">
        This profile doesn't exist or isn't visible to you.
      </EmptyState>
    )
  }
  if (!person || !me) return <Spinner page />

  const subline = [person.title, person.organization].filter(Boolean).join(', ')

  return (
    <div className="mx-auto max-w-2xl">
      <Card padded>
        <div className="flex items-start gap-4">
          <Avatar name={person.full_name} size="lg" staff={person.role === 'admin'} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight">{person.full_name}</h1>
            <p className="mt-1 text-sm font-medium text-clay-deep">{affiliationLabel(person)}</p>
            {subline && <p className="mt-1 text-sm text-faint">{subline}</p>}
            {person.location && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-faint">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> {person.location}
              </p>
            )}
          </div>
        </div>
        {person.bio && (
          <p className="mt-5 whitespace-pre-line border-t border-line pt-5 text-sm leading-relaxed text-ink">
            {person.bio}
          </p>
        )}
        {person.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {person.tags.map((t) => <Badge key={t}>{t}</Badge>)}
          </div>
        )}
      </Card>

      {person.role === 'member' && offers && offers.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl">Open doors from {person.full_name.split(' ')[0]}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {offers.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        </section>
      )}

      {me.id !== person.id && (
        <div className="mt-6 flex justify-end">
          <ReportButton target="user" targetId={person.id} />
        </div>
      )}

      {me.id === person.id && (
        <p className="mt-6 text-center text-sm text-faint">
          This is how others see you. <Link to="/profile" className="text-pine hover:underline">Edit your profile</Link>
        </p>
      )}
    </div>
  )
}
