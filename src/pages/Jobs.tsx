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

const JOB_TYPES: JobType[] = ['internship', 'part-time', 'full-time', 'volunteer']
const LOCATION_TYPES: LocationType[] = ['remote', 'in-person', 'hybrid']
type SortOption = 'newest' | 'deadline' | 'company'

export default function Jobs() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
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
    return b.created_at.localeCompare(a.created_at)
  })
  const closedJobs = filtered.filter((j) => !isJobActive(j))

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

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search by title, company, or keyword…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
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

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-ink-muted shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFilter('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${filter === ''
                    ? 'bg-primary-muted border-primary text-primary'
                    : 'border-border text-ink-secondary hover:bg-primary-faint'
                  }`}
              >
                All
              </button>
              {JOB_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(filter === t ? '' : t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
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

          <div className="flex gap-1.5 flex-wrap">
            {LOCATION_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setLocFilter(locFilter === t ? '' : t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${locFilter === t
                    ? 'bg-primary-muted border-primary text-primary'
                    : 'border-border text-ink-secondary hover:bg-primary-faint'
                  }`}
              >
                {LOCATION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          <select
            value={indFilter}
            onChange={(e) => setIndFilter(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-ink-secondary
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
              className="px-2 py-1.5 rounded-lg text-xs font-medium border border-border bg-surface text-ink-secondary
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              <option value="newest">Newest first</option>
              <option value="deadline">Deadline (soonest)</option>
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
          <button
            onClick={() => { setFetchError(false); setRetryCount((n) => n + 1) }}
            className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted text-base">No opportunities match your filters.</p>
          {(search || filter || locFilter || indFilter) && (
            <button
              onClick={() => { setSearch(''); setFilter(''); setLocFilter(''); setIndFilter('') }}
              className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
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
