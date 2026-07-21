import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { OfferCard } from '../../components/OfferCard'
import type { OfferWithPoster } from '../../components/OfferCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { OFFER_KINDS, OFFER_KIND_META } from '../../types'
import type { OfferKind } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { friendlyError } from '../../lib/errors'

const POSTER_JOIN = 'poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year, organization)'

export function Board() {
  const { profile } = useAuth()
  const [offers, setOffers] = useState<OfferWithPoster[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<OfferKind | 'all'>('all')
  const [includeSettled, setIncludeSettled] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const query = supabase
        .from('offers')
        .select(`*, ${POSTER_JOIN}`)
        .is('hidden_at', null)
        .order('created_at', { ascending: false })
      const { data, error: err } = await (includeSettled
        ? query.in('status', ['open', 'filled', 'closed'])
        : query.eq('status', 'open'))
      if (cancelled) return
      if (err) {
        setError(friendlyError(err))
        return
      }
      setOffers((data ?? []) as unknown as OfferWithPoster[])
    }
    load()
    return () => { cancelled = true }
  }, [includeSettled])

  const visible = useMemo(
    () => (offers ?? []).filter((o) => kindFilter === 'all' || o.kind === kindFilter),
    [offers, kindFilter],
  )

  return (
    <div>
      <header>
        <h1 className="text-3xl">The Board</h1>
        <p className="mt-2 max-w-xl text-sm text-faint">
          {profile?.role === 'student'
            ? 'Every door here was opened for CRMS students specifically. When one fits, raise your hand.'
            : 'What the community is offering students right now.'}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setKindFilter('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${kindFilter === 'all' ? 'bg-pine text-white' : 'bg-card border border-line text-faint hover:text-ink'}`}
        >
          Everything
        </button>
        {OFFER_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKindFilter(kindFilter === k ? 'all' : k)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${kindFilter === k ? 'bg-pine text-white' : 'bg-card border border-line text-faint hover:text-ink'}`}
          >
            {OFFER_KIND_META[k].label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-faint">
          <input
            type="checkbox"
            checked={includeSettled}
            onChange={(e) => setIncludeSettled(e.target.checked)}
            className="h-3.5 w-3.5 accent-pine"
          />
          Include filled & closed
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <EmptyState title="The board didn't load">{error}</EmptyState>
        ) : offers === null ? (
          <Spinner page />
        ) : visible.length === 0 ? (
          <EmptyState title={kindFilter === 'all' ? 'The board is quiet right now' : `No ${OFFER_KIND_META[kindFilter as OfferKind].label.toLowerCase()} doors right now`}>
            New offers land here as members post them — check back soon.
          </EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visible.map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        )}
      </div>
    </div>
  )
}
