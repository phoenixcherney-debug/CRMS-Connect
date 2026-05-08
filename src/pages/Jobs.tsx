import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, Plus, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react'
import { isPast, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, JobType, LocationType } from '../types'
import { JOB_TYPE_LABELS, LOCATION_TYPE_LABELS, INDUSTRY_OPTIONS } from '../types'
import JobCard from '../components/JobCard'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

// Mirror the post form's category dropdown so every published opportunity
// has a corresponding chip on /jobs (audit caught Mentorship / Job Shadow /
// Other being un-filterable here).
const JOB_TYPES: JobType[] = ['internship', 'part-time', 'full-time', 'volunteer', 'mentorship', 'shadow', 'other']
const LOCATION_TYPES: LocationType[] = ['remote', 'in-person', 'hybrid']
type SortOption = 'newest' | 'oldest' | 'deadline' | 'company' | 'title'

export default function Jobs() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [filter, setFilter] = useState<JobType | ''>('')
  const [locFilter, setLocFilter] = useState<LocationType | ''>('')
  const [indFilter, setIndFilter] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')

  const isPoster = profile?.role === 'employer_mentor'

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true)
      setFetchError(false)
      const { data, error } = await supabase
        .from('jobs')
        .select('*, profiles(id, full_name, role)')
        .order('created_at', { ascending: false })

      if (error) {
        setFetchError(true)
      } else if (data) {
        setJobs(data as Job[])
      }
      setLoading(false)
    }
    fetchJobs()
  }, [retryCount])

  // Audit task 1 — /jobs is the community-wide index of active openings.
  // Both roles see every active opportunity here. /my-postings is the only
  // place that scopes to `posted_by = current_user`.
  const filtered = jobs.filter((j) => {
    const matchesSearch =
      search === '' ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase())
    const matchesType = filter === '' || j.job_type === filter
    const matchesLoc = locFilter === '' || j.location_type === locFilter
    const matchesInd = indFilter === '' || j.industry === indFilter
    return matchesSearch && matchesType && matchesLoc && matchesInd
  })

  const isJobActive = (j: Job) => j.is_active && (!j.deadline || !isPast(parseISO(j.deadline)))
  const activeJobs = filtered.filter(isJobActive).sort((a, b) => {
    if (sort === 'deadline') {
      if (!a.deadline) return 1
      if (!b.deadline) return -1
      return a.deadline.localeCompare(b.deadline)
    }
    if (sort === 'company') return a.company.localeCompare(b.company)
    if (sort === 'title')   return a.title.localeCompare(b.title)
    if (sort === 'oldest')  return a.created_at.localeCompare(b.created_at)
    return b.created_at.localeCompare(a.created_at)
  })
  // Closed jobs panel only renders the viewer's own closed postings (still
  // useful to employers as a "your archive" preview from /jobs); the
  // canonical archive lives on /my-postings.
  const closedJobs = filtered.filter((j) => !isJobActive(j) && j.posted_by === profile?.id)

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Opportunities</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {loading
              ? 'Loading…'
              : `${activeJobs.length} active opening${activeJobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isPoster && (
          <Link
            to="/jobs/new"
            className="btn-gold shrink-0"
          >
            <Plus size={16} />
            Post an opportunity
          </Link>
        )}
      </div>

      {/* Search bar — own row so the input can never collapse to zero width
          when filter chips wrap (audit regression: search rendered as a bare
          icon because flex-1 children with no min-width were getting squeezed). */}
      <div className="mb-3">
        <div className="relative w-full">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by title, company, or keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-9 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
              placeholder:text-ink-placeholder
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
              transition-colors"
          />
          {search && (
            <button type="button"
              onClick={() => {
                // Audit task 7 — clear local state AND remove ?q from the URL
                // so the cleared input doesn't leave a stale query in history.
                setSearch('')
                if (searchParams.has('q')) {
                  const next = new URLSearchParams(searchParams)
                  next.delete('q')
                  setSearchParams(next, { replace: true })
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter & sort bar — Type and Location chips live in distinct labeled
          groups so users see them as separate filter dimensions (audit §13). */}
      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-3 flex-wrap">
          <SlidersHorizontal size={15} className="text-ink-muted shrink-0 mt-2" />

          {/* Type group */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mr-1">Type</span>
            <button type="button"
              onClick={() => setFilter('')}
              aria-label="All types"
              aria-pressed={filter === ''}
              className={`px-3 py-2 min-h-[36px] sm:min-h-[44px] rounded-lg text-xs font-medium border transition-colors
                ${filter === ''
                  ? 'bg-primary-muted border-primary text-primary'
                  : 'border-border text-ink-secondary hover:bg-primary-faint'
                }`}
            >
              All
            </button>
            {JOB_TYPES.map((t) => (
              <button type="button"
                key={t}
                onClick={() => setFilter(filter === t ? '' : t)}
                aria-pressed={filter === t}
                className={`px-3 py-2 min-h-[36px] sm:min-h-[44px] rounded-lg text-xs font-medium border transition-colors
                  ${filter === t
                    ? 'bg-primary-muted border-primary text-primary'
                    : 'border-border text-ink-secondary hover:bg-primary-faint'
                  }`}
              >
                {JOB_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3 flex-wrap pl-7">
          {/* Location group */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mr-1">Location</span>
            <button type="button"
              onClick={() => setLocFilter('')}
              aria-label="All locations"
              aria-pressed={locFilter === ''}
              className={`px-3 py-2 min-h-[36px] sm:min-h-[44px] rounded-lg text-xs font-medium border transition-colors
                ${locFilter === ''
                  ? 'bg-primary-muted border-primary text-primary'
                  : 'border-border text-ink-secondary hover:bg-primary-faint'
                }`}
            >
              All
            </button>
            {LOCATION_TYPES.map((t) => (
              <button type="button"
                key={t}
                onClick={() => setLocFilter(locFilter === t ? '' : t)}
                aria-pressed={locFilter === t}
                className={`px-3 py-2 min-h-[36px] sm:min-h-[44px] rounded-lg text-xs font-medium border transition-colors
                  ${locFilter === t
                    ? 'bg-primary-muted border-primary text-primary'
                    : 'border-border text-ink-secondary hover:bg-primary-faint'
                  }`}
              >
                {LOCATION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap pl-7">
          <select
            value={indFilter}
            onChange={(e) => setIndFilter(e.target.value)}
            className="px-2 py-2 min-h-[36px] sm:min-h-[44px] rounded-lg text-xs font-medium border border-border bg-surface text-ink-secondary
              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          >
            <option value="">All Industries</option>
            {INDUSTRY_OPTIONS.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={13} className="text-ink-muted" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="px-2 py-2 min-h-[36px] sm:min-h-[44px] rounded-lg text-xs font-medium border border-border bg-surface text-ink-secondary
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="deadline">Deadline (soonest)</option>
              <option value="title">Title A–Z</option>
              <option value="company">Company A–Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-20">
          <p className="text-ink-muted">Failed to load opportunities.</p>
          <button type="button"
            onClick={() => { setFetchError(false); setRetryCount((n) => n + 1) }}
            className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No opportunities match your filters."
          ctaLabel={search || filter || locFilter || indFilter ? 'Clear filters' : undefined}
          ctaOnClick={
            search || filter || locFilter || indFilter
              ? () => { setSearch(''); setFilter(''); setLocFilter(''); setIndFilter('') }
              : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {/* Active jobs */}
          {activeJobs.length > 0 && (
            <section>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activeJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </section>
          )}

          {/* Closed jobs */}
          {closedJobs.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-3">
                Closed
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {closedJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
