import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Building2, Briefcase, X, ChevronDown, ChevronUp } from 'lucide-react'
import { isPast, parseISO, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Job } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

interface EmployerEntry {
  company: string
  jobs: Job[]
  activeCount: number
  types: string[]
}

export default function Employers() {
  const [employers, setEmployers] = useState<EmployerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState('')
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setFetchError(false)
      const { data, error } = await supabase
        .from('jobs')
        .select('*, profiles(id, full_name)')
        .order('created_at', { ascending: false })

      if (error) { setFetchError(true); setLoading(false); return }
      const jobs = (data as Job[]) ?? []

      // Group by company
      const map = new Map<string, EmployerEntry>()
      for (const job of jobs) {
        if (!map.has(job.company)) {
          map.set(job.company, { company: job.company, jobs: [], activeCount: 0, types: [] })
        }
        const entry = map.get(job.company)!
        entry.jobs.push(job)
        if (job.is_active && (!job.deadline || !isPast(parseISO(job.deadline)))) entry.activeCount++
        if (!entry.types.includes(job.job_type)) entry.types.push(job.job_type)
      }

      const sorted = Array.from(map.values()).sort((a, b) =>
        b.activeCount !== a.activeCount
          ? b.activeCount - a.activeCount
          : a.company.localeCompare(b.company)
      )
      setEmployers(sorted)
      setLoading(false)
    }
    load()
  }, [retryCount])

  const filtered = employers.filter((e) =>
    !search || e.company.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Employers</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading
            ? 'Loading…'
            : `${employers.length} company${employers.length !== 1 ? 's' : ''} have posted opportunities`}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search companies…"
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

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">Failed to load employers.</p>
          <button
            onClick={() => setRetryCount((n) => n + 1)}
            className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
          >
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <Building2 size={36} className="mx-auto text-ink-muted mb-3" />
          <p className="text-ink-muted text-sm">
            {search ? `No companies found for "${search}"` : 'No employers yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((employer) => {
            const isExpanded = expandedCompany === employer.company
            const activeJobs = employer.jobs.filter(
              (j) => j.is_active && (!j.deadline || !isPast(parseISO(j.deadline)))
            )
            const closedJobs = employer.jobs.filter(
              (j) => !j.is_active || (j.deadline && isPast(parseISO(j.deadline)))
            )

            return (
              <div
                key={employer.company}
                className="bg-surface rounded-xl border border-border overflow-hidden"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                {/* Company header */}
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Company initial */}
                    <div className="w-12 h-12 rounded-xl bg-primary-muted flex items-center justify-center text-primary font-bold text-lg shrink-0">
                      {employer.company[0].toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink text-base">{employer.company}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-ink-muted">
                          {employer.jobs.length} total listing{employer.jobs.length !== 1 ? 's' : ''}
                        </span>
                        {employer.activeCount > 0 && (
                          <>
                            <span className="text-ink-muted">·</span>
                            <span className="text-xs text-success font-medium">
                              {employer.activeCount} active
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {employer.types.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-primary-faint text-xs text-ink-secondary"
                          >
                            <Briefcase size={10} />
                            {JOB_TYPE_LABELS[t as keyof typeof JOB_TYPE_LABELS]}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedCompany(isExpanded ? null : employer.company)}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-ink-secondary hover:bg-primary-faint transition-colors"
                    >
                      {isExpanded ? (
                        <><ChevronUp size={13} /> Hide</>
                      ) : (
                        <><ChevronDown size={13} /> Jobs</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded jobs list */}
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {activeJobs.length > 0 && (
                      <>
                        <div className="px-5 py-2 bg-primary-faint">
                          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                            Open Positions
                          </p>
                        </div>
                        {activeJobs.map((job) => (
                          <JobRow key={job.id} job={job} />
                        ))}
                      </>
                    )}
                    {closedJobs.length > 0 && (
                      <>
                        <div className="px-5 py-2 bg-border/20">
                          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                            Closed
                          </p>
                        </div>
                        {closedJobs.map((job) => (
                          <JobRow key={job.id} job={job} closed />
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function JobRow({ job, closed }: { job: Job; closed?: boolean }) {
  const deadline = job.deadline ? parseISO(job.deadline) : null
  return (
    <Link
      to={`/jobs/${job.id}`}
      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-primary-faint transition-colors ${closed ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{job.title}</p>
        <p className="text-xs text-ink-muted mt-0.5">{job.location}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-xs text-ink-muted">
        <span>{JOB_TYPE_LABELS[job.job_type]}</span>
        <span>·</span>
        <span>{closed ? 'Closed' : deadline ? `Due ${format(deadline, 'MMM d')}` : 'Rolling'}</span>
      </div>
    </Link>
  )
}
