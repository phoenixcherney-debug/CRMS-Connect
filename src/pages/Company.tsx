import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Building2, Globe, MapPin, Users, ChevronLeft, ExternalLink, Briefcase } from 'lucide-react'
import { isPast, parseISO, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import { safeExternalHref } from '../lib/url'
import Spinner from '../components/Spinner'

interface CompanyMeta {
  name_key: string
  display_name: string
  description: string | null
  logo_url: string | null
  website_url: string | null
  hq_location: string | null
  industry: string | null
}

interface JobWithApps extends Job {
  applications: { id: string; status: string }[]
}

/**
 * P1-2 — public company page. Aggregates everything posted under a given
 * company name and surfaces the meta row from `company_meta`. The URL
 * uses the lower-cased name as the slug; if anyone has typed a variant
 * casing on a posting, the lookup still resolves because we lower() at
 * read time.
 */
export default function Company() {
  const { profile } = useAuth()
  const { id: rawSlug } = useParams<{ id: string }>()
  const slug = decodeURIComponent(rawSlug ?? '').toLowerCase()
  const [meta, setMeta]   = useState<CompanyMeta | null>(null)
  const [jobs, setJobs]   = useState<JobWithApps[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: metaRow }, { data: jobsRows }] = await Promise.all([
        supabase
          .from('company_meta')
          .select('*')
          .eq('name_key', slug)
          .maybeSingle(),
        supabase
          .from('jobs')
          .select('*, applications(id, status), profiles!jobs_posted_by_fkey(id, full_name)')
          .ilike('company', slug)
          .order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      const j = (jobsRows as JobWithApps[] | null) ?? []
      if (!metaRow && j.length === 0) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setMeta(metaRow as CompanyMeta | null)
      setJobs(j)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  // Derive a display name from meta (canonical) or the first job row
  // (preserves the casing the first poster used).
  const displayName = meta?.display_name
    ?? (jobs[0]?.company ?? slug)

  // Stats
  const activeJobs = jobs.filter((j) => j.is_active && (!j.deadline || !isPast(parseISO(j.deadline))))
  const totalApplicants = jobs.reduce((sum, j) => sum + (j.applications?.length ?? 0), 0)
  const totalAccepted   = jobs.reduce(
    (sum, j) => sum + (j.applications?.filter((a) => a.status === 'accepted').length ?? 0), 0
  )

  const posters = (() => {
    const seen = new Set<string>()
    const out: { id: string; name: string }[] = []
    for (const j of jobs) {
      const p = j.profiles as { id?: string; full_name?: string } | null | undefined
      if (!p?.id || seen.has(p.id)) continue
      seen.add(p.id)
      out.push({ id: p.id, name: p.full_name ?? 'Unknown' })
    }
    return out
  })()

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }
  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Building2 size={36} className="mx-auto text-ink-muted mb-3" />
        <h1 className="text-xl font-bold text-ink mb-1" style={{ fontFamily: 'var(--font-serif)' }}>
          Company not found
        </h1>
        <p className="text-sm text-ink-muted">No company has posted under that name yet.</p>
        <Link to="/employers" className="inline-block mt-4 text-sm font-medium text-primary hover:text-primary-light">
          ← Back to all companies
        </Link>
      </div>
    )
  }

  const safeWeb = safeExternalHref(meta?.website_url)
  // P1-6 — only people who have posted under this company (or admins) see the
  // "Edit company info" affordance via /employers; here we just show the
  // existing meta read-only and link them to the directory if they want to edit.
  const canEdit = profile?.role === 'admin'
    || jobs.some((j) => j.posted_by === profile?.id)

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/employers" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-5">
        <ChevronLeft size={16} /> All companies
      </Link>

      {/* Header */}
      <div
        className="bg-surface rounded-2xl border border-border p-6 mb-5 flex flex-col sm:flex-row gap-5"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="w-20 h-20 rounded-2xl bg-primary-muted flex items-center justify-center text-primary font-bold text-3xl shrink-0 overflow-hidden">
          {meta?.logo_url ? (
            <img
              src={meta.logo_url}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            displayName[0]?.toUpperCase() ?? '?'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
            {displayName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-ink-secondary">
            {meta?.industry && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border border-primary-muted bg-primary-faint text-primary">
                {meta.industry}
              </span>
            )}
            {meta?.hq_location && (
              <span className="inline-flex items-center gap-1 text-xs"><MapPin size={11} />{meta.hq_location}</span>
            )}
            {safeWeb && (
              <a
                href={safeWeb}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Globe size={11} />
                {safeWeb.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          {meta?.description && (
            <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line mt-3">
              {meta.description}
            </p>
          )}
          {!meta?.description && canEdit && (
            <p className="text-xs text-ink-muted mt-3">
              No description yet —{' '}
              <Link to="/employers" className="text-primary hover:underline font-medium">
                add one from the Employers list
              </Link>.
            </p>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-center">
        <Stat icon={Briefcase} value={jobs.length} label={jobs.length === 1 ? 'opportunity' : 'opportunities'} />
        <Stat icon={Briefcase} value={activeJobs.length} label="active" />
        <Stat icon={Users} value={totalApplicants} label={totalApplicants === 1 ? 'applicant' : 'applicants'} />
        <Stat icon={Users} value={totalAccepted} label="accepted" />
      </div>

      {/* People */}
      {posters.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-semibold text-ink mb-2">People at {displayName}</p>
          <div className="flex flex-wrap gap-2">
            {posters.map((p) => (
              <Link
                key={p.id}
                to={`/people/${p.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-primary-faint text-xs font-medium text-ink-secondary transition-colors"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Opportunities */}
      <div>
        <p className="text-sm font-semibold text-ink mb-2">Opportunities</p>
        {jobs.length === 0 ? (
          <p className="text-sm text-ink-muted italic">No opportunities posted yet.</p>
        ) : (
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
            {jobs.map((job) => {
              const closed = !job.is_active || (job.deadline && isPast(parseISO(job.deadline)))
              return (
                <Link
                  key={job.id}
                  to={`/opportunities/${job.id}`}
                  className={`flex items-center gap-3 px-5 py-3.5 hover:bg-primary-faint transition-colors ${closed ? 'opacity-60' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{job.title}</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {job.location}
                      {job.applications && job.applications.length > 0 && (
                        <span className="ml-2">· {job.applications.length} {job.applications.length === 1 ? 'applicant' : 'applicants'}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-ink-muted">
                    <span>{JOB_TYPE_LABELS[job.job_type]}</span>
                    <span>·</span>
                    <span>
                      {closed ? 'Closed' : job.deadline ? `Due ${format(parseISO(job.deadline), 'MMM d')}` : 'Rolling'}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, value, label }: {
  icon: typeof Building2
  value: number
  label: string
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-3" style={{ boxShadow: 'var(--shadow-card)' }}>
      <Icon size={14} className="mx-auto text-ink-muted mb-1" />
      <p className="text-lg font-bold text-ink leading-none">{value}</p>
      <p className="text-[11px] text-ink-muted mt-0.5">{label}</p>
    </div>
  )
}
