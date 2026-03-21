import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, X, ChevronLeft, MessageSquare, UserPlus, UserMinus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, Role } from '../types'
import { ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

export default function People() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | ''>('')
  const [messaging, setMessaging] = useState<string | null>(null)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [followLoading, setFollowLoading] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: peopleData }, { data: followsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('onboarding_complete', true)
          .order('full_name', { ascending: true }),
        profile
          ? supabase.from('follows').select('following_id').eq('follower_id', profile.id)
          : Promise.resolve({ data: [] }),
      ])
      setPeople((peopleData as Profile[]) ?? [])
      setFollowedIds(new Set(((followsData ?? []) as { following_id: string }[]).map((r) => r.following_id)))
      setLoading(false)
    }
    load()
  }, [profile?.id])

  const filtered = people.filter((p) => {
    if (p.id === profile?.id) return false
    const matchesSearch =
      search === '' ||
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.bio ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === '' || p.role === roleFilter
    return matchesSearch && matchesRole
  })

  async function toggleFollow(e: React.MouseEvent, personId: string) {
    e.preventDefault()
    if (!profile || followLoading) return
    setFollowLoading(personId)
    if (followedIds.has(personId)) {
      await supabase.from('follows').delete().eq('follower_id', profile.id).eq('following_id', personId)
      setFollowedIds((prev) => { const s = new Set(prev); s.delete(personId); return s })
    } else {
      await supabase.from('follows').insert({ follower_id: profile.id, following_id: personId })
      setFollowedIds((prev) => new Set(prev).add(personId))
    }
    setFollowLoading(null)
  }

  async function startConversation(e: React.MouseEvent, otherId: string) {
    e.preventDefault()
    if (!profile || messaging) return
    setMessaging(otherId)

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${otherId}),` +
        `and(participant_one.eq.${otherId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) {
      setMessaging(null)
      navigate(`/inbox/${existing.id}`)
      return
    }

    const [p1, p2] = [profile.id, otherId].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select()
      .single()

    setMessaging(null)
    if (data) navigate(`/inbox/${data.id}`)
  }

  const roles: Role[] = ['student', 'alumni', 'parent']

  return (
    <div>
      <div className="mb-6">
        <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-ink-secondary hover:text-ink mb-3">
          <ChevronLeft size={16} /> Explore
        </Link>
        <h1 className="text-2xl font-bold text-ink">People</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${filtered.length} member${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or bio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
              placeholder:text-ink-placeholder
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
              transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setRoleFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
              ${roleFilter === '' ? 'bg-primary-muted border-primary text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
          >
            All
          </button>
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                ${roleFilter === r ? 'bg-primary-muted border-primary text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
            >
              {ROLE_LABELS[r]}s
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">No members match your search.</p>
          {(search || roleFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter('') }}
              className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => {
            const initials = person.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
            const followed = followedIds.has(person.id)
            return (
              <Link
                key={person.id}
                to={`/people/${person.id}`}
                className="bg-surface rounded-xl border border-border p-4 hover:shadow-md transition-shadow block"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.full_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm truncate">{person.full_name}</p>
                    <p className="text-xs text-ink-muted capitalize">
                      {ROLE_LABELS[person.role]}
                      {person.graduation_year ? ` · Class of ${person.graduation_year}` : ''}
                    </p>
                  </div>
                </div>
                {person.bio && (
                  <p className="text-xs text-ink-secondary mt-3 leading-relaxed line-clamp-3">{person.bio}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={(e) => toggleFollow(e, person.id)}
                    disabled={followLoading === person.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                      text-sm font-medium border transition-colors disabled:opacity-50
                      ${followed
                        ? 'bg-primary-muted border-primary/30 text-primary hover:bg-primary-faint'
                        : 'bg-primary hover:bg-primary-light text-white border-transparent'
                      }`}
                  >
                    {followLoading === person.id ? (
                      <Spinner size="sm" className={followed ? '' : 'border-white/30 border-t-white'} />
                    ) : followed ? (
                      <UserMinus size={13} />
                    ) : (
                      <UserPlus size={13} />
                    )}
                    {followed ? 'Unfollow' : 'Follow'}
                  </button>
                  <button
                    onClick={(e) => startConversation(e, person.id)}
                    disabled={messaging === person.id}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                      border border-border text-sm text-ink-secondary hover:bg-primary-faint
                      hover:text-ink transition-colors disabled:opacity-50"
                  >
                    {messaging === person.id ? <Spinner size="sm" /> : <MessageSquare size={14} />}
                  </button>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
