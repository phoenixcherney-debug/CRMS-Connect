import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, SlidersHorizontal, X } from 'lucide-react'
import { isPast, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, JobType } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import JobCard from '../components/JobCard'
import Spinner from '../components/Spinner'

const JOB_TYPES: JobType[] = ['internship', 'part-time', 'full-time', 'volunteer']

export default function Jobs() {
  const { profile } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<JobType | ''>('')

  const isPoster = profile?.role === 'alumni' || profile?.role === 'parent'

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true)
      const { data, error } = await supabase
        .from('jobs')
        .select('*, profiles(id, full_name, role)')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setJobs(data as Job[])
      }
      setLoading(false)
    }
    fetchJobs()
  }, [])

  const filtered = jobs.filter((j) => {
    const matchesSearch =
      search === '' ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.company.toLowerCase().includes(search.toLowerCase()) ||
      j.description.toLowerCase().includes(search.toLowerCase())
    const matchesType = filter === '' || j.job_type === filter
    return matchesSearch && matchesType
  })

  const activeJobs = filtered.filter((j) => j.is_active && !isPast(parseISO(j.deadline)))
  const closedJobs = filtered.filter((j) => !j.is_active || isPast(parseISO(j.deadline)))

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Opportunities</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {loading
              ? 'Loading…'
              : `${activeJobs.length} active opening${activeJobs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isPoster && (
          <Link
            to="/jobs/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-primary hover:bg-primary-light text-white font-medium text-sm
              transition-colors shrink-0"
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
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-ink-muted text-base">No opportunities match your search.</p>
          {(search || filter) && (
            <button
              onClick={() => { setSearch(''); setFilter('') }}
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
