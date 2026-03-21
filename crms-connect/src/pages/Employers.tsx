import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, MapPin, Briefcase, ChevronLeft, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Job } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

interface Employer {
  name: string
  locations: string[]
  jobTypes: string[]
  jobCount: number
  activeCount: number
  jobs: Job[]
}

export default function Employers() {
  const [employers, setEmployers] = useState<Employer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false })

      const jobs = (data as Job[]) ?? []
      const map = new Map<string, Job[]>()

      for (const job of jobs) {
        const key = job.company.trim()
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(job)
      }

      const result: Employer[] = Array.from(map.entries())
        .map(([name, companyJobs]) => ({
          name,
          locations: [...new Set(companyJobs.map((j) => j.location))],
          jobTypes: [...new Set(companyJobs.map((j) => JOB_TYPE_LABELS[j.job_type]))],
          jobCount: companyJobs.length,
          activeCount: companyJobs.filter((j) => j.is_active).length,
          jobs: companyJobs,
        }))
        .sort((a, b) => b.activeCount - a.activeCount || b.jobCount - a.jobCount)

      setEmployers(result)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = employers.filter(
    (e) =>
      search === '' ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.locations.some((l) => l.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <div className="mb-6">
        <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-ink-secondary hover:text-ink mb-3">
          <ChevronLeft size={16} /> Explore
        </Link>
        <h1 className="text-2xl font-bold text-ink">Employers</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${filtered.length} compan${filtered.length !== 1 ? 'ies' : 'y'} with listings`}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search companies or locations…"
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

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <Building2 size={32} className="text-ink-muted mx-auto mb-2" />
          <p className="text-ink-muted">No companies match your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((employer) => (
            <div
              key={employer.name}
              className="bg-surface rounded-xl border border-border overflow-hidden"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <button
                onClick={() => setExpanded(expanded === employer.name ? null : employer.name)}
                className="w-full p-4 flex items-start gap-4 text-left hover:bg-primary-faint/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-primary-muted flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {employer.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-ink">{employer.name}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {employer.locations.join(', ')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Briefcase size={11} />
                      {employer.activeCount} active · {employer.jobCount} total
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {employer.jobTypes.map((t) => (
                      <span key={t} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary-faint text-primary border border-primary-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>

              {expanded === employer.name && (
                <div className="border-t border-border px-4 py-3 space-y-2">
                  {employer.jobs.map((job) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-primary-faint transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{job.title}</p>
                        <p className="text-xs text-ink-muted flex items-center gap-1">
                          <MapPin size={10} /> {job.location}
                        </p>
                      </div>
                      <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                        job.is_active
                          ? 'bg-primary-muted text-primary border-primary-muted'
                          : 'bg-border/40 text-ink-muted border-border'
                      }`}>
                        {job.is_active ? JOB_TYPE_LABELS[job.job_type] : 'Closed'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
