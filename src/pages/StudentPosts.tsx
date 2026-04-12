import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, MessageSquare, X, SlidersHorizontal, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { StudentPost } from '../types'
import {
  STUDENT_SEEKING_LABELS, WEEKLY_AVAILABILITY_OPTIONS, INTEREST_OPTIONS, STUDENT_GRADES,
} from '../types'
import type { StudentGrade } from '../types'
import Spinner from '../components/Spinner'

export default function StudentPosts() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [posts, setPosts] = useState<StudentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState('')
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  // Filters
  const [filterInterests, setFilterInterests] = useState<string[]>([])
  const [filterAvailability, setFilterAvailability] = useState('')
  const [filterGrade, setFilterGrade] = useState<StudentGrade | ''>('')
  const [filterSeeking, setFilterSeeking] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setFetchError(false)
      const { data, error } = await supabase
        .from('student_posts')
        .select('*, profiles(id, full_name, role, avatar_url, graduation_year, grade, interests, weekly_availability, student_seeking)')
        .eq('is_closed', false)
        .order('created_at', { ascending: false })
      if (error) {
        setFetchError(true)
      } else {
        setPosts((data as StudentPost[]) ?? [])
      }
      setLoading(false)
    }
    if (profile) load()
  }, [retryCount, profile?.id])

  async function openConversation(studentId: string) {
    if (!profile || creatingFor) return
    setCreatingFor(studentId)

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${studentId}),` +
        `and(participant_one.eq.${studentId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) {
      setCreatingFor(null)
      navigate(`/messages/${existing.id}`)
      return
    }

    const [p1, p2] = [profile.id, studentId].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()

    setCreatingFor(null)
    if (data) navigate(`/messages/${data.id}`)
  }

  const hasActiveFilters = filterInterests.length > 0 || filterAvailability || filterGrade || filterSeeking

  const filtered = posts.filter((p) => {
    const student = p.profiles as { full_name?: string; grade?: string | null; interests?: string[]; weekly_availability?: string | null; student_seeking?: string | null } | null
    if (search && student?.full_name && !student.full_name.toLowerCase().includes(search.toLowerCase())) return false

    if (filterInterests.length > 0) {
      const postInterests = p.interests ?? []
      if (!filterInterests.some((fi) => postInterests.includes(fi))) return false
    }

    if (filterAvailability && p.availability !== filterAvailability) return false
    if (filterGrade && student?.grade !== filterGrade) return false
    if (filterSeeking && p.seeking !== filterSeeking) return false

    return true
  })

  function clearFilters() {
    setFilterInterests([])
    setFilterAvailability('')
    setFilterGrade('')
    setFilterSeeking('')
  }

  function toggleInterest(interest: string) {
    setFilterInterests((prev) => prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest])
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Student Postings</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${filtered.length} student${filtered.length !== 1 ? 's' : ''} looking for opportunities`}
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
              placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors
            ${showFilters || hasActiveFilters ? 'border-primary bg-primary-muted text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
        >
          <SlidersHorizontal size={14} />
          Filters
          {hasActiveFilters && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>
              {(filterInterests.length > 0 ? 1 : 0) + (filterAvailability ? 1 : 0) + (filterGrade ? 1 : 0) + (filterSeeking ? 1 : 0)}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-sm text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors">
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-surface border border-border rounded-xl p-4 mb-5 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Looking for</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STUDENT_SEEKING_LABELS).map(([val, label]) => (
                <button key={val} onClick={() => setFilterSeeking(filterSeeking === val ? '' : val)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${filterSeeking === val ? 'bg-primary-muted border-primary text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Grade</p>
            <div className="flex flex-wrap gap-1.5">
              {STUDENT_GRADES.map((g) => (
                <button key={g} onClick={() => setFilterGrade(filterGrade === g ? '' : g)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${filterGrade === g ? 'bg-primary-muted border-primary text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Availability</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKLY_AVAILABILITY_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => setFilterAvailability(filterAvailability === opt ? '' : opt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${filterAvailability === opt ? 'bg-primary-muted border-primary text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">Interests</p>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {INTEREST_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => toggleInterest(opt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${filterInterests.includes(opt) ? 'bg-primary text-white border-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}>
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
          <p className="text-ink-muted">Failed to load student posts.</p>
          <button onClick={() => setRetryCount((n) => n + 1)} className="mt-3 text-sm text-primary hover:text-primary-light font-medium">Try again</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <FileText size={32} className="mx-auto text-ink-muted mb-3" />
          <p className="text-ink-muted text-sm">
            {search || hasActiveFilters ? 'No student posts match your filters.' : 'No student posts yet.'}
          </p>
          {(search || hasActiveFilters) && (
            <button onClick={() => { setSearch(''); clearFilters() }} className="mt-3 text-sm text-primary hover:text-primary-light font-medium">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => {
            const student = post.profiles as { id?: string; full_name?: string; avatar_url?: string | null; grade?: string | null; graduation_year?: number | null } | null
            const studentId = student?.id ?? post.student_id
            const initials = student?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'
            const seekingLabel = STUDENT_SEEKING_LABELS[post.seeking] ?? post.seeking

            return (
              <div key={post.id} className="bg-surface rounded-xl border border-border p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="flex items-start gap-3">
                  <Link to={`/people/${studentId}`} className="shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm overflow-hidden">
                      {student?.avatar_url ? (
                        <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ) : initials}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to={`/people/${studentId}`} className="font-semibold text-ink hover:text-primary transition-colors">
                        {student?.full_name ?? 'Student'}
                      </Link>
                      {student?.grade && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-border text-ink-secondary font-medium">{student.grade}</span>
                      )}
                      {student?.graduation_year && !student.grade && (
                        <span className="text-xs text-ink-muted">Class of {student.graduation_year}</span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary-faint text-primary font-medium">
                        Looking for: {seekingLabel}
                      </span>
                    </div>

                    {post.availability && (
                      <p className="text-xs text-ink-muted mt-0.5">{post.availability}</p>
                    )}

                    {post.interests && post.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.interests.map((interest) => (
                          <span key={interest} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary-muted text-primary">
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}

                    {post.pitch && (
                      <p className="text-sm text-ink-secondary mt-2 leading-relaxed line-clamp-3">{post.pitch}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => openConversation(studentId)}
                  disabled={creatingFor === studentId}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg
                    border border-border text-xs font-medium text-ink-secondary
                    hover:bg-primary-faint hover:text-ink disabled:opacity-50 transition-colors"
                >
                  <MessageSquare size={13} />
                  {creatingFor === studentId ? 'Opening…' : `Message ${student?.full_name?.split(' ')[0] ?? 'student'}`}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
