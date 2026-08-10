import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { OFFER_POSTER_JOIN } from '../../lib/joins'
import { PAGE_SIZE } from '../../lib/constants'
import { OfferCard } from '../../components/OfferCard'
import type { OfferWithPoster } from '../../components/OfferCard'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { OFFER_KINDS, OFFER_KIND_META, LOCATION_MODE_LABEL } from '../../types'
import type { OfferKind, LocationMode } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { friendlyError } from '../../lib/errors'

type SortOrder = 'newest' | 'oldest'

interface Filters {
  kind: OfferKind | 'all'
  location: LocationMode | 'all'
  minSpots: number
  sort: SortOrder
  search: string
  includeSettled: boolean
}

const INITIAL: Filters = {
  kind: 'all',
  location: 'all',
  minSpots: 0,
  sort: 'newest',
  search: '',
  includeSettled: false,
}

const CONTROL = 'rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm focus:border-pine focus:ring-2 focus:ring-pine/20'

export function Board() {
  const { profile } = useAuth()
  const [offers, setOffers] = useState<OfferWithPoster[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(INITIAL)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [searchInput, setSearchInput] = useState('')

  // Any filter change resets pagination back to the first page.
  const patch = (p: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...p }))
    setLimit(PAGE_SIZE)
  }

  // Debounce the keyword box so we don't fire a query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() }))
      setLimit(PAGE_SIZE)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async (isActive: () => boolean) => {
    let q = supabase.from('offers').select(`*, ${OFFER_POSTER_JOIN}`).is('hidden_at', null)
    q = filters.includeSettled ? q.in('status', ['open', 'filled', 'closed']) : q.eq('status', 'open')
    if (filters.kind !== 'all') q = q.eq('kind', filters.kind)
    if (filters.location !== 'all') q = q.eq('location_mode', filters.location)
    if (filters.minSpots > 0) q = q.gte('spots', filters.minSpots)
    if (filters.search) {
      // Sanitize characters that would break the PostgREST or() filter grammar.
      const safe = filters.search.replace(/[%,()*\\]/g, ' ').trim()
      if (safe) q = q.or(`title.ilike.*${safe}*,description.ilike.*${safe}*`)
    }
    const { data, error: err } = await q
      .order('created_at', { ascending: filters.sort === 'oldest' })
      .range(0, limit - 1)
    if (!isActive()) return
    if (err) {
      setError(friendlyError(err))
      return
    }
    setError(null)
    setOffers((data ?? []))
  }, [filters, limit])

  usePageData(load)

  const filtersActive =
    filters.kind !== 'all' || filters.location !== 'all' || filters.minSpots > 0 ||
    !!filters.search || filters.includeSettled
  const hasMore = (offers?.length ?? 0) === limit

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium ${active ? 'bg-pine text-white' : 'bg-card border border-input text-faint hover:text-ink'}`

  return (
    <div>
      <header>
        <h1 className="text-3xl">The Board</h1>
        <p className="mt-2 max-w-xl text-sm text-faint">
          {profile?.role === 'student'
            ? 'Every door here was opened for CRMS students specifically. When one fits, knock on the door.'
            : 'What the community is offering students right now.'}
        </p>
      </header>

      {/* Type chips */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={filters.kind === 'all'} onClick={() => patch({ kind: 'all' })} className={chip(filters.kind === 'all')}>
          Everything
        </button>
        {OFFER_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filters.kind === k}
            onClick={() => patch({ kind: filters.kind === k ? 'all' : k })}
            className={chip(filters.kind === k)}
          >
            {OFFER_KIND_META[k].label}
          </button>
        ))}
      </div>

      {/* Search + refinements */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search doors…"
          aria-label="Search offers by keyword"
          className={`w-56 ${CONTROL}`}
        />
        <select value={filters.location} onChange={(e) => patch({ location: e.target.value as LocationMode | 'all' })} aria-label="Filter by location" className={CONTROL}>
          <option value="all">Anywhere</option>
          {(Object.keys(LOCATION_MODE_LABEL) as LocationMode[]).map((m) => (
            <option key={m} value={m}>{LOCATION_MODE_LABEL[m]}</option>
          ))}
        </select>
        <select value={String(filters.minSpots)} onChange={(e) => patch({ minSpots: Number(e.target.value) })} aria-label="Filter by number of spots offered" className={CONTROL}>
          <option value="0">Any spots</option>
          <option value="2">2+ spots offered</option>
          <option value="3">3+ spots offered</option>
          <option value="5">5+ spots offered</option>
        </select>
        <select value={filters.sort} onChange={(e) => patch({ sort: e.target.value as SortOrder })} aria-label="Sort by date posted" className={CONTROL}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <label className="ml-auto flex cursor-pointer items-center gap-2 py-1 text-sm text-faint">
          <input
            type="checkbox"
            checked={filters.includeSettled}
            onChange={(e) => patch({ includeSettled: e.target.checked })}
            className="h-4 w-4 accent-pine"
          />
          Include filled &amp; closed
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <EmptyState title="The board didn't load">{error}</EmptyState>
        ) : offers === null ? (
          <Spinner page />
        ) : offers.length === 0 ? (
          <EmptyState title={filtersActive ? 'No doors match those filters' : 'The board is quiet right now'}>
            {filtersActive
              ? 'Try widening your filters — clear the search or pick a different type.'
              : 'New offers land here as members post them — check back soon.'}
          </EmptyState>
        ) : (
          <>
            <h2 className="sr-only">Open doors</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {offers.map((o) => <OfferCard key={o.id} offer={o} />)}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
