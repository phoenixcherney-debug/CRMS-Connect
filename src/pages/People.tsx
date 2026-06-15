import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, MessageSquare, X, Heart, SlidersHorizontal } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastProvider'
import { friendlyError } from '../lib/errors'
import { initialsOf } from '../lib/initials'
import { pluralize } from '../lib/pluralize'
import { disambiguateNames } from '../lib/disambiguateNames'
import ReportUserButton from '../components/ReportUserButton'
import ShortlistButton from '../components/ShortlistButton'
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
  const toast = useToast()

  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState('')
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  // Filters
  const [filterInterests, setFilterInterests] = useState<string[]>([])
  // Phase 1.5 — hide empty/clearly-test profiles by default on /students.
  const [showEmpty, setShowEmpty] = useState(false)
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
      // P1-13 — the /mentors directory now respects the
      // \`open_to_mentorship\` toggle. Mentors with the toggle off don't
      // appear in the list; they can still be reached via opportunity
      // bylines or direct profile links. /students directory is unchanged.
      let q = supabase
        .from('profiles')
        .select('id, full_name, role, graduation_year, bio, avatar_url, company, industry, open_to_mentorship, mentorship_paused_until, interests, weekly_availability, mentor_type, student_seeking, grade, share_grade_with_employers, student_outreach_consent, created_at')
        .eq('role', targetRole)
        .is('banned_at', null)
        .order('full_name', { ascending: true })
      if (directory === 'mentors') q = q.eq('open_to_mentorship', true)
      const { data, error } = await q
      if (error) {
        setFetchError(true)
      } else {
        // P1-10 — drop mentors whose pause-until is still in the future
        // (server-side filter on a nullable date is awkward enough that
        // post-filtering is cheaper).
        const today = new Date().toISOString().split('T')[0]
        const rows = ((data as Profile[]) ?? []).filter((p) => {
          if (directory !== 'mentors') return true
          const pause = (p.mentorship_paused_until as string | null | undefined)
          return !pause || pause <= today
        })
        setPeople(rows)
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
    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()

    setCreatingFor(null)
    if (error || !data) {
      toast(friendlyError(error, 'Could not start that conversation.'), { kind: 'error' })
      return
    }
    navigate(`/messages/${data.id}`)
  }

  const hasActiveFilters = filterInterests.length > 0 || filterAvailability || filterGrade || filterLooking

  // Phase 1.5 — for the students directory, an "empty" profile has all
  // three of: no bio, no interests, no avatar. We hide these by default
  // so the directory looks active; the user can opt back in.
  function isEmptyStudent(p: Profile): boolean {
    if (targetRole !== 'student') return false
    const bioEmpty = !p.bio || p.bio.trim().length === 0
    const interestsEmpty = !p.interests || p.interests.length === 0
    const avatarEmpty = !p.avatar_url
    return bioEmpty && interestsEmpty && avatarEmpty
  }
  const hiddenEmptyCount = targetRole === 'student'
    ? people.filter((p) => p.id !== profile?.id && isEmptyStudent(p)).length
    : 0

  const filtered = people.filter((p) => {
    if (p.id === profile?.id) return false
    if (!showEmpty && isEmptyStudent(p)) return false
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
  // S6.6 — for /mentors specifically, count is "open to new mentees" (rows
  // already filtered server-side via .eq('open_to_mentorship', true)).
  // Surface that explicitly so an empty list reads as "no one's open" rather
  // than "no mentors exist".
  // Phase 1.5 — when empty profiles are hidden, the count reflects what
  // the user actually sees, with a tooltip explaining the delta.
  const baseVisibleCount = people.filter((p) => p.id !== profile?.id).length
  const visibleCount = !showEmpty
    ? baseVisibleCount - hiddenEmptyCount
    : baseVisibleCount
  const pageSubtitle = loading
    ? 'Loading…'
    : directory === 'mentors'
      ? `${pluralize(visibleCount, 'mentor')} accepting new mentees right now`
      : `${pluralize(visibleCount, pageTitle.toLowerCase().slice(0, -1))} in the CRMS community`

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>{pageTitle}</h1>
        <p
          className="text-ink-secondary text-sm mt-0.5"
          title={hiddenEmptyCount > 0 && !showEmpty ? `(${hiddenEmptyCount} hidden — incomplete profiles)` : undefined}
        >
          {pageSubtitle}
        </p>
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

      {/* Phase 1.5 — toggle to surface incomplete profiles. Students directory only. */}
      {targetRole === 'student' && hiddenEmptyCount > 0 && (
        <div className="mb-4 text-xs text-ink-muted">
          {showEmpty ? (
            <>
              Showing all profiles, including {pluralize(hiddenEmptyCount, 'incomplete profile')}.{' '}
              <button type="button" onClick={() => setShowEmpty(false)} className="text-primary hover:text-primary-light underline font-medium">
                Hide empty profiles
              </button>
            </>
          ) : (
            <>
              {pluralize(hiddenEmptyCount, 'incomplete profile')} hidden.{' '}
              <button type="button" onClick={() => setShowEmpty(true)} className="text-primary hover:text-primary-light underline font-medium">
                Show empty profiles
              </button>
            </>
          )}
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
            {/* M-12 — when /mentors is empty without filters, the issue is
                no mentor has flipped open_to_mentorship on. The previous
                copy ("No members match your filters.") was misleading. */}
            {search
              ? `No members found for "${search}"`
              : hasActiveFilters
                ? 'No members match your filters.'
                : directory === 'mentors'
                  ? 'No mentors are open to new mentees right now.'
                  : directory === 'students'
                    ? 'No students yet.'
                    : 'No members yet.'}
          </p>
          {(search || hasActiveFilters) && (
            <button type="button" onClick={() => { setSearch(''); clearFilters() }} className="mt-3 text-sm text-primary hover:text-primary-light font-medium">
              Clear filters
            </button>
          )}
          {/* S6.6 — when /mentors is empty (no filters), give the student a
              real next step rather than a dead end. */}
          {!search && !hasActiveFilters && directory === 'mentors' && (
            <p className="mt-3 text-xs text-ink-muted">
              Want to be a mentor, or know someone who should be?{' '}
              <a href="mailto:registrar@crms.org" className="text-primary hover:text-primary-light font-medium">
                Email the registrar
              </a>.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {disambiguateNames(filtered).map(({ user: person, nameSuffix }) => {
            const initials = initialsOf(person.full_name)
            const isSelf = person.id === profile?.id
            const isEM = person.role === 'employer_mentor'

            return (
              <div
                key={person.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/people/${person.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/people/${person.id}`)
                  }
                }}
                /* P2-24 — full-card click affordance. The Message button
                    inside calls e.stopPropagation() to keep its onClick
                    from also firing this navigate. */
                className="bg-surface rounded-xl border border-border p-5 flex flex-col cursor-pointer hover:border-primary-muted hover:bg-primary-faint/40 transition-colors"
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
                      {/* F.2 — render-time disambiguation when two users share
                          the same display name. The suffix is computed by
                          disambiguateNames() and falls back gracefully (e.g.
                          "joined May 2026") if grade/year aren't shareable. */}
                      {nameSuffix && (
                        <span className="text-ink-muted font-normal"> — {nameSuffix}</span>
                      )}
                    </Link>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary-faint text-primary font-medium">
                        {ROLE_LABELS[person.role]}
                      </span>
                      {/* A.1 — both grade AND graduation year are gated on
                          share_grade_with_employers. Previously Class of YYYY
                          rendered as a fallback when grade was hidden, which
                          leaked the cohort regardless of the toggle. Either
                          opt-in OR neither. (Listing view is non-self only,
                          so we don't need an isOwner check here.) */}
                      {person.role === 'student' && person.share_grade_with_employers && (
                        <>
                          {person.grade && (
                            <span className="text-xs px-1.5 py-0.5 rounded-md bg-border text-ink-secondary font-medium">
                              {person.grade}
                            </span>
                          )}
                          {person.graduation_year && !person.grade && (
                            <span className="text-xs text-ink-muted">Class of {person.graduation_year}</span>
                          )}
                        </>
                      )}
                      {person.role !== 'student' && person.graduation_year && (
                        <span className="text-xs text-ink-muted">Class of {person.graduation_year}</span>
                      )}
                      {isEM && person.open_to_mentorship && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-success-bg text-success font-medium flex items-center gap-0.5">
                          <Heart size={9} /> Mentor
                        </span>
                      )}
                    </div>
                    {isEM && (person.industry || person.company) && (
                      <p
                        className="text-xs text-ink-muted mt-1 truncate"
                        title={[person.industry, person.company].filter(Boolean).join(' · ')}
                      >
                        {[person.industry, person.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* L-05/L-06 — always reserve a fixed slot for the bio so
                    cards in the same row line up; render "No bio yet."
                    when the field is empty. */}
                <div className="mt-3 min-h-[2.5rem]">
                  {person.bio ? (
                    <>
                      <p className="text-xs text-ink-secondary line-clamp-2 leading-relaxed">
                        {person.bio}
                      </p>
                      {/* F.3 — always render the Read more affordance when a
                          bio exists. Detecting actual overflow needs JS
                          (ResizeObserver) and can flicker; always-show is
                          consistent and the link target is the full profile
                          either way. */}
                      <span className="text-xs text-primary font-medium mt-0.5 inline-block">
                        Read more →
                      </span>
                    </>
                  ) : (
                    <p className="text-xs text-ink-muted italic">No bio yet.</p>
                  )}
                </div>
                {/* Spacer pushes the Message button to the bottom when the
                    bio is short or absent, keeping cards visually aligned in
                    the same row (audit §20). */}
                <div className="flex-1" />

                {/* P0-6 — same-role DM block was removed (migration 057
                    dropped the trigger). Anyone non-self can be messaged.
                    P0-8 — Report mounts directly on the directory card so
                    flagging doesn't require navigating to the full profile. */}
                {!isSelf && (() => {
                  // Task 2 — adult cannot DM a non-consenting student.
                  const outreachBlocked =
                    profile?.role === 'employer_mentor'
                    && person.role === 'student'
                    && !person.student_outreach_consent
                  return (
                    <div className="mt-3 flex gap-2 items-stretch" onClick={(e) => e.stopPropagation()}>
                      {!outreachBlocked && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); openConversation(person.id) }}
                          disabled={creatingFor === person.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                            border border-border text-xs font-medium text-ink-secondary
                            hover:bg-primary-faint hover:text-ink
                            disabled:opacity-50 transition-colors"
                        >
                          <MessageSquare size={13} />
                          {creatingFor === person.id ? 'Opening…' : 'Message'}
                        </button>
                      )}
                      {outreachBlocked && (
                        <span
                          className="flex-1 inline-flex items-center justify-center px-3 py-2 rounded-lg border border-dashed border-border text-[11px] text-ink-muted"
                          title="This student isn't accepting outreach yet"
                        >
                          Not accepting outreach
                        </span>
                      )}
                      {person.role === 'student' && (
                        <ShortlistButton studentId={person.id} className="px-2 py-2" />
                      )}
                      <ReportUserButton targetId={person.id} targetName={person.full_name} />
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
