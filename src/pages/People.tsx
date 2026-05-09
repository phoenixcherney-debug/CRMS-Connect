import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, MessageSquare, X, Heart, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile } from '../types'
import {
  ROLE_LABELS, WEEKLY_AVAILABILITY_OPTIONS, STUDENT_GRADES,
  MENTOR_TYPE_LABELS, STUDENT_SEEKING_LABELS, INTEREST_OPTIONS,
} from '../types'
import type { StudentGrade } from '../types'
import Spinner from '../components/Spinner'

interface PeopleProps {
  /**
   * Audit M1: which directory to render. When omitted, falls back to the
   * legacy "opposite role" behavior so /people keeps working as a redirect
   * source while the new /students and /mentors routes stabilize.
   */
  directory?: 'students' | 'mentors'
}

export default function People({ directory }: PeopleProps = {}) {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState('')
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  // Filters
  const [filterInterests, setFilterInterests] = useState<string[]>([])
  const [filterAvailability, setFilterAvailability] = useState('')
  const [filterGrade, setFilterGrade] = useState<StudentGrade | ''>('')
  const [filterLooking, setFilterLooking] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const isStudent = profile?.role === 'student'

  // Pick the directory's role. Explicit prop wins; otherwise fall back to
  // the role opposite the viewer's (legacy /people behavior).
  const targetRole = directory === 'students'
    ? 'student'
    : directory === 'mentors'
      ? 'employer_mentor'
      : (isStudent ? 'employer_mentor' : 'student')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setFetchError(false)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, graduation_year, bio, avatar_url, company, industry, open_to_mentorship, interests, weekly_availability, mentor_type, student_seeking, grade, share_grade_with_employers, created_at')
        .eq('role', targetRole)
        .order('full_name', { ascending: true })
      if (error) {
        setFetchError(true)
      } else {
        setPeople((data as Profile[]) ?? [])
      }
      setLoading(false)
    }
    if (profile) load()
  }, [retryCount, profile?.id])

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

  const hasActiveFilters = filterInterests.length > 0 || filterAvailability || filterGrade || filterLooking

  const filtered = people.filter((p) => {
    if (p.id === profile?.id) return false
    if (search && !p.full_name.toLowerCase().includes(search.toLowerCase())) return false

    // Interest/Industry filter — driven by which directory we're rendering,
    // so /students filtering works the same whether the viewer is an EM
    // (legacy) or a student (M11 lift).
    if (filterInterests.length > 0) {
      if (targetRole === 'employer_mentor') {
        if (!p.industry || !filterInterests.includes(p.industry)) return false
      } else {
        const personInterests = p.interests ?? []
        if (!filterInterests.some((fi) => personInterests.includes(fi))) return false
      }
    }

    // Availability filter
    if (filterAvailability && p.weekly_availability !== filterAvailability) return false

    // Grade filter (students directory only). M9: opted-out students are
    // treated as having no grade and never surface in grade-filtered lists.
    if (filterGrade && targetRole === 'student') {
      if (!p.share_grade_with_employers || p.grade !== filterGrade) return false
    }

    // Looking-for filter — student_seeking when listing students, mentor_type
    // when listing EMs.
    if (filterLooking) {
      if (targetRole === 'student') {
        if (p.student_seeking !== filterLooking) return false
      } else {
        if (p.mentor_type !== filterLooking) return false
      }
    }

    return true
  })

  function clearFilters() {
    setFilterInterests([])
    setFilterAvailability('')
    setFilterGrade('')
    setFilterLooking('')
  }

  function toggleInterest(interest: string) {
    setFilterInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    )
  }

  const pageTitle = targetRole === 'employer_mentor' ? 'Mentors' : 'Students'
  const pageSubtitle = loading
    ? 'Loading…'
    : `${people.filter((p) => p.id !== profile?.id).length} ${pageTitle.toLowerCase()} in the CRMS community`

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>{pageTitle}</h1>
        <p className="text-ink-secondary text-sm mt-0.5">{pageSubtitle}</p>
      </div>

      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
              placeholder:text-ink-placeholder
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>
        <button type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors
            ${showFilters || hasActiveFilters
              ? 'border-primary bg-primary-muted text-primary'
              : 'border-border text-ink-secondary hover:bg-primary-faint'
            }`}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActiveFilters && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
              {(filterInterests.length > 0 ? 1 : 0) + (filterAvailability ? 1 : 0) + (filterGrade ? 1 : 0) + (filterLooking ? 1 : 0)}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button type="button"
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-sm text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors"
          >
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>

          {/* Availability */}
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Availability</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKLY_AVAILABILITY_OPTIONS.map((opt) => (
                <button type="button"
                  key={opt}
                  onClick={() => setFilterAvailability(filterAvailability === opt ? '' : opt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                    ${filterAvailability === opt
                      ? 'bg-primary-muted border-primary text-primary'
                      : 'border-border text-ink-secondary hover:bg-primary-faint'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Grade (only when listing students) */}
          {targetRole === 'student' && (
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Grade</p>
              <div className="flex flex-wrap gap-1.5">
                {STUDENT_GRADES.map((g) => (
                  <button type="button"
                    key={g}
                    onClick={() => setFilterGrade(filterGrade === g ? '' : g)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                      ${filterGrade === g
                        ? 'bg-primary-muted border-primary text-primary'
                        : 'border-border text-ink-secondary hover:bg-primary-faint'
                      }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Looking for */}
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              {targetRole === 'student' ? 'Looking for' : 'Mentor type'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {targetRole === 'student'
                ? Object.entries(STUDENT_SEEKING_LABELS).map(([val, label]) => (
                    <button type="button"
                      key={val}
                      onClick={() => setFilterLooking(filterLooking === val ? '' : val)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                        ${filterLooking === val
                          ? 'bg-primary-muted border-primary text-primary'
                          : 'border-border text-ink-secondary hover:bg-primary-faint'
                        }`}
                    >
                      {label}
                    </button>
                  ))
                : Object.entries(MENTOR_TYPE_LABELS).map(([val, label]) => (
                    <button type="button"
                      key={val}
                      onClick={() => setFilterLooking(filterLooking === val ? '' : val)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                        ${filterLooking === val
                          ? 'bg-primary-muted border-primary text-primary'
                          : 'border-border text-ink-secondary hover:bg-primary-faint'
                        }`}
                    >
                      {label}
                    </button>
                  ))
              }
            </div>
          </div>

          {/* Interests / Industry */}
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">
              {targetRole === 'employer_mentor' ? 'Industry' : 'Interests'}
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {INTEREST_OPTIONS.map((opt) => (
                <button type="button"
                  key={opt}
                  onClick={() => toggleInterest(opt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                    ${filterInterests.includes(opt)
                      ? 'bg-primary text-white border-primary'
                      : 'border-border text-ink-secondary hover:bg-primary-faint'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">Failed to load people.</p>
          <button type="button" onClick={() => setRetryCount((n) => n + 1)} className="mt-3 text-sm text-primary hover:text-primary-light font-medium">
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted text-sm">
            {search ? `No members found for "${search}"` : 'No members match your filters.'}
          </p>
          {(search || hasActiveFilters) && (
            <button type="button" onClick={() => { setSearch(''); clearFilters() }} className="mt-3 text-sm text-primary hover:text-primary-light font-medium">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((person) => {
            const initials = person.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
            const isSelf = person.id === profile?.id
            const isEM = person.role === 'employer_mentor'

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
                        <img src={person.avatar_url} alt={person.full_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : initials}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/people/${person.id}`} className="font-semibold text-ink truncate hover:text-primary transition-colors block">
                      {person.full_name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary-faint text-primary font-medium">
                        {ROLE_LABELS[person.role]}
                      </span>
                      {/* Grade badge for students. Audit M9: only show if
                          the student opted in to share their grade. */}
                      {person.grade && person.share_grade_with_employers && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-border text-ink-secondary font-medium">
                          {person.grade}
                        </span>
                      )}
                      {person.graduation_year && (!person.grade || !person.share_grade_with_employers) && (
                        <span className="text-xs text-ink-muted">Class of {person.graduation_year}</span>
                      )}
                      {isEM && person.open_to_mentorship && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-success-bg text-success font-medium flex items-center gap-0.5">
                          <Heart size={9} /> Mentor
                        </span>
                      )}
                    </div>
                    {isEM && (person.industry || person.company) && (
                      <p className="text-xs text-ink-muted mt-1">
                        {[person.industry, person.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {person.bio ? (
                  <p className="text-xs text-ink-secondary mt-3 line-clamp-2 leading-relaxed">
                    {person.bio}
                  </p>
                ) : null}
                {/* Spacer pushes the Message button to the bottom when the
                    bio is short or absent, keeping cards visually aligned in
                    the same row (audit §20). */}
                <div className="flex-1" />

                {/* P0-1 — same-role DMs blocked. */}
                {!isSelf && (profile?.role === 'admin' || person.role !== profile?.role) && (
                  <button type="button"
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
