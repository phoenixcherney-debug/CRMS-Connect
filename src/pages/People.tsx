import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, MessageSquare, X, Heart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, Role } from '../types'
import { ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

const ROLE_FILTERS: Array<'all' | Role> = ['all', 'student', 'alumni', 'parent']

export default function People() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [mentorOnly, setMentorOnly] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setFetchError(false)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, graduation_year, bio, avatar_url, company, industry, open_to_mentorship, created_at')
        .order('full_name', { ascending: true })
      if (error) {
        setFetchError(true)
      } else {
        setPeople((data as Profile[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [retryCount])

  async function openConversation(otherId: string) {
    if (!profile || creatingFor) return
    setCreatingFor(otherId)

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${otherId}),` +
        `and(participant_one.eq.${otherId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) {
      setCreatingFor(null)
      navigate(`/messages/${existing.id}`)
      return
    }

    const [p1, p2] = [profile.id, otherId].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()

    setCreatingFor(null)
    if (data) navigate(`/messages/${data.id}`)
  }

  const filtered = people.filter((p) => {
    if (p.id === profile?.id) return false
    if (roleFilter !== 'all' && p.role !== roleFilter) return false
    if (mentorOnly && !p.open_to_mentorship) return false
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const ROLE_COUNT = (ROLE_FILTERS.slice(1) as Role[]).reduce(
    (acc, r) => {
      acc[r] = people.filter((p) => p.id !== profile?.id && p.role === r).length
      return acc
    },
    {} as Record<Role, number>
  )

  const mentorCount = people.filter((p) => p.id !== profile?.id && p.open_to_mentorship).length

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>People</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${people.filter((p) => p.id !== profile?.id).length} members in the CRMS community`}
        </p>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
              placeholder:text-ink-placeholder
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
              transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors
              ${roleFilter === 'all'
                ? 'bg-primary-muted border-primary text-primary'
                : 'border-border text-ink-secondary hover:bg-primary-faint'
              }`}
          >
            All
          </button>
          {(ROLE_FILTERS.slice(1) as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors
                ${roleFilter === r
                  ? 'bg-primary-muted border-primary text-primary'
                  : 'border-border text-ink-secondary hover:bg-primary-faint'
                }`}
            >
              {ROLE_LABELS[r]}
              {!loading && (
                <span className="ml-1.5 text-ink-muted">({ROLE_COUNT[r] ?? 0})</span>
              )}
            </button>
          ))}
          {mentorCount > 0 && (
            <button
              onClick={() => setMentorOnly(!mentorOnly)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1
                ${mentorOnly
                  ? 'bg-success-bg border-status-accepted-border text-success'
                  : 'border-border text-ink-secondary hover:bg-primary-faint'
                }`}
            >
              <Heart size={11} />
              Mentors
              <span className="ml-0.5 text-ink-muted">({mentorCount})</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">Failed to load people.</p>
          <button
            onClick={() => setRetryCount((n) => n + 1)}
            className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted text-sm">
            {search ? `No members found for "${search}"` : mentorOnly ? 'No mentors available yet.' : 'No members in this category yet.'}
          </p>
          {(search || mentorOnly || roleFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setMentorOnly(false); setRoleFilter('all') }}
              className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => {
            const initials = person.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
            const isSelf = person.id === profile?.id
            const isPoster = person.role === 'alumni' || person.role === 'parent'

            return (
              <div
                key={person.id}
                className="bg-surface rounded-xl border border-border p-5 flex flex-col"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-start gap-3">
                  <Link to={`/people/${person.id}`} className="shrink-0">
                    <div className="w-11 h-11 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold overflow-hidden">
                      {person.avatar_url ? (
                        <img
                          src={person.avatar_url}
                          alt={person.full_name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : initials}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/people/${person.id}`} className="font-semibold text-ink truncate hover:text-primary transition-colors block">{person.full_name}</Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary-faint text-primary font-medium capitalize">
                        {ROLE_LABELS[person.role]}
                      </span>
                      {person.graduation_year && (
                        <span className="text-xs text-ink-muted">Class of {person.graduation_year}</span>
                      )}
                      {isPoster && person.open_to_mentorship && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-success-bg text-success font-medium flex items-center gap-0.5">
                          <Heart size={9} /> Mentor
                        </span>
                      )}
                    </div>
                    {isPoster && (person.industry || person.company) && (
                      <p className="text-xs text-ink-muted mt-1">
                        {[person.industry, person.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {person.bio && (
                  <p className="text-xs text-ink-secondary mt-3 line-clamp-2 leading-relaxed flex-1">
                    {person.bio}
                  </p>
                )}

                {!isSelf && (
                  <button
                    onClick={() => openConversation(person.id)}
                    disabled={creatingFor === person.id}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                      border border-border text-xs font-medium text-ink-secondary
                      hover:bg-primary-faint hover:text-ink
                      disabled:opacity-50 transition-colors"
                  >
                    <MessageSquare size={13} />
                    {creatingFor === person.id ? 'Opening…' : 'Message'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
