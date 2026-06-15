import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Building2, Briefcase, X, ChevronDown, ChevronUp, ExternalLink, MapPin } from 'lucide-react'
import { isPast, parseISO, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { JOB_COLUMNS } from '../lib/jobColumns'
import type { Job } from '../types'
import { JOB_TYPE_LABELS, INDUSTRY_OPTIONS } from '../types'
import Spinner from '../components/Spinner'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import { safeExternalHref } from '../lib/url'

interface CompanyMeta {
  name_key: string
  display_name: string
  description: string | null
  logo_url: string | null
  website_url: string | null
  hq_location: string | null
  industry: string | null
}

interface EmployerEntry {
  company: string
  jobs: Job[]
  activeCount: number
  types: string[]
  meta: CompanyMeta | null
  /** Whether the current viewer has posted under this company name and
   *  is therefore allowed to edit the meta row. */
  canEditMeta: boolean
}

export default function Employers() {
  const { profile } = useAuth()
  const [employers, setEmployers] = useState<EmployerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [search, setSearch] = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setFetchError(false)
      const { data, error } = await supabase
        .from('jobs')
        .select(`${JOB_COLUMNS}, profiles!jobs_posted_by_fkey(id, full_name)`)
        .is('hidden_by_admin_at', null)
        .order('created_at', { ascending: false })

      if (error) { setFetchError(true); setLoading(false); return }
      const jobs = (data as unknown as Job[]) ?? []

      // Group by company
      const map = new Map<string, EmployerEntry>()
      for (const job of jobs) {
        if (!map.has(job.company)) {
          map.set(job.company, {
            company: job.company,
            jobs: [],
            activeCount: 0,
            types: [],
            meta: null,
            canEditMeta: false,
          })
        }
        const entry = map.get(job.company)!
        entry.jobs.push(job)
        if (job.is_active && (!job.deadline || !isPast(parseISO(job.deadline)))) entry.activeCount++
        if (!entry.types.includes(job.job_type)) entry.types.push(job.job_type)
      }

      // P1-6 — fetch the matching company_meta rows in one round-trip.
      const keys = Array.from(map.keys()).map((c) => c.toLowerCase())
      if (keys.length > 0) {
        const { data: metas } = await supabase
          .from('company_meta')
          .select('*')
          .in('name_key', keys)
        for (const m of (metas as CompanyMeta[] | null) ?? []) {
          for (const entry of map.values()) {
            if (entry.company.toLowerCase() === m.name_key) {
              entry.meta = m
            }
          }
        }
      }

      // Mark which companies the viewer can edit (they've posted under it).
      if (profile) {
        for (const entry of map.values()) {
          entry.canEditMeta = entry.jobs.some((j) => j.posted_by === profile.id) || profile.role === 'admin'
        }
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
  }, [retryCount, profile?.id, profile?.role])

  const filtered = employers.filter((e) => {
    if (search && !e.company.toLowerCase().includes(search.toLowerCase())) return false
    if (filterIndustry && (e.meta?.industry ?? '') !== filterIndustry) return false
    return true
  })

  const allIndustries = Array.from(new Set(
    employers.map((e) => e.meta?.industry).filter((i): i is string => !!i)
  )).sort()

  function updateMetaInState(name: string, meta: CompanyMeta) {
    setEmployers((prev) => prev.map((e) => e.company === name ? { ...e, meta } : e))
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Companies</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          Organizations in the CRMS network — click to see their open opportunities.
        </p>
      </div>

      {/* Search + industry filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
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
            <button type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {/* P1-6 — industry filter, populated from company_meta. Hidden when
            no company has set an industry yet. */}
        {allIndustries.length > 0 && (
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">All industries</option>
            {allIndustries.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">Failed to load employers.</p>
          <button type="button"
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
                {/* Company header. P2-24 — entire header toggles expand. */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedCompany(isExpanded ? null : employer.company)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setExpandedCompany(isExpanded ? null : employer.company)
                    }
                  }}
                  className="p-5 cursor-pointer hover:bg-primary-faint/40 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* P1-6 — logo from company_meta when present, initial fallback. */}
                    <div className="w-12 h-12 rounded-xl bg-primary-muted flex items-center justify-center text-primary font-bold text-lg shrink-0 overflow-hidden">
                      {employer.meta?.logo_url ? (
                        <img
                          src={employer.meta.logo_url}
                          alt={employer.company}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        employer.company[0].toUpperCase()
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* P1-2 — link to the dedicated company page. Stops
                          click bubbling so the row's expand toggle doesn't
                          also fire. */}
                      <Link
                        to={`/companies/${encodeURIComponent(employer.company.toLowerCase())}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-ink text-base hover:text-primary transition-colors"
                      >
                        {employer.company}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-ink-muted">
                          {employer.jobs.length} total opportunit{employer.jobs.length !== 1 ? 'ies' : 'y'}
                        </span>
                        {employer.activeCount > 0 && (
                          <>
                            <span className="text-ink-muted">·</span>
                            <span className="text-xs text-success font-medium">
                              {employer.activeCount} active
                            </span>
                          </>
                        )}
                        {employer.meta?.hq_location && (
                          <>
                            <span className="text-ink-muted">·</span>
                            <span className="text-xs text-ink-muted flex items-center gap-0.5">
                              <MapPin size={10} />{employer.meta.hq_location}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {employer.meta?.industry && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-primary-muted bg-primary-faint text-xs text-primary font-medium">
                            {employer.meta.industry}
                          </span>
                        )}
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

                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setExpandedCompany(isExpanded ? null : employer.company) }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-ink-secondary hover:bg-primary-faint transition-colors"
                    >
                      {isExpanded ? (
                        <><ChevronUp size={13} /> Hide</>
                      ) : (
                        <><ChevronDown size={13} /> View</>
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded jobs list */}
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {/* P1-6 — company meta panel. Shows description / website
                        / industry; an inline editor opens for posters. */}
                    {(employer.meta?.description || employer.meta?.website_url || employer.canEditMeta) && (
                      <div className="px-5 py-4 bg-surface">
                        {employer.meta?.description && (
                          <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-line mb-2">
                            {employer.meta.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          {employer.meta?.website_url && safeExternalHref(employer.meta.website_url) && (
                            <a
                              href={safeExternalHref(employer.meta.website_url)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              {employer.meta.website_url.replace(/^https?:\/\//, '')}
                              <ExternalLink size={11} />
                            </a>
                          )}
                          {employer.canEditMeta && (
                            <CompanyMetaEditor
                              company={employer.company}
                              meta={employer.meta}
                              onSaved={(m) => updateMetaInState(employer.company, m)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    {/* Audit task 24 — show the people behind the company.
                        Dedupe by poster id; link each to /people/<id>. */}
                    {(() => {
                      const seen = new Set<string>()
                      const people: { id: string; name: string }[] = []
                      for (const j of employer.jobs) {
                        const p = j.profiles as { id?: string; full_name?: string } | null | undefined
                        if (!p?.id || seen.has(p.id)) continue
                        seen.add(p.id)
                        people.push({ id: p.id, name: p.full_name ?? 'Unknown' })
                      }
                      if (people.length === 0) return null
                      return (
                        <>
                          <div className="px-5 py-2 bg-primary-faint">
                            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                              People at {employer.company}
                            </p>
                          </div>
                          <div className="px-5 py-3 flex flex-wrap gap-2">
                            {people.map((p) => (
                              <Link
                                key={p.id}
                                to={`/people/${p.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-surface hover:bg-primary-faint text-ink-secondary transition-colors"
                              >
                                {p.name}
                              </Link>
                            ))}
                          </div>
                        </>
                      )
                    })()}
                    {activeJobs.length > 0 && (
                      <>
                        <div className="px-5 py-2 bg-primary-faint">
                          <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                            Open Opportunities
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
  const posterName = (job.profiles as any)?.full_name as string | undefined
  return (
    <Link
      to={`/opportunities/${job.id}`}
      className={`flex items-center gap-3 px-5 py-3.5 hover:bg-primary-faint transition-colors ${closed ? 'opacity-60' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{job.title}</p>
        <p className="text-xs text-ink-muted mt-0.5">
          {job.location}
          {posterName && <span className="text-ink-muted/70">{' · '}Posted by {posterName}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-xs text-ink-muted">
        <span>{JOB_TYPE_LABELS[job.job_type]}</span>
        <span>·</span>
        <span>{closed ? 'Closed' : deadline ? `Due ${format(deadline, 'MMM d')}` : 'Rolling'}</span>
      </div>
    </Link>
  )
}

// ─── CompanyMetaEditor ──────────────────────────────────────────────────────
// P1-6 — inline modal editor for company_meta. RLS gates writes so the
// "Edit company info" button can only be clicked by users who have posted
// under this company (or admins). New rows are upserted by name_key.
function CompanyMetaEditor({
  company, meta, onSaved,
}: {
  company: string
  meta: CompanyMeta | null
  onSaved: (m: CompanyMeta) => void
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState(meta?.description ?? '')
  const [logoUrl, setLogoUrl]         = useState(meta?.logo_url ?? '')
  const [websiteUrl, setWebsiteUrl]   = useState(meta?.website_url ?? '')
  const [hqLocation, setHqLocation]   = useState(meta?.hq_location ?? '')
  const [industry, setIndustry]       = useState(meta?.industry ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasMeta = !!meta?.description || !!meta?.logo_url || !!meta?.website_url

  function reset() {
    setDescription(meta?.description ?? '')
    setLogoUrl(meta?.logo_url ?? '')
    setWebsiteUrl(meta?.website_url ?? '')
    setHqLocation(meta?.hq_location ?? '')
    setIndustry(meta?.industry ?? '')
    setError(null)
  }

  async function save() {
    if (!profile) return
    setError(null)
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) { setError('Logo URL must start with http:// or https://'); return }
    if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) { setError('Website URL must start with http:// or https://'); return }
    if (description.length > 500) { setError('Description must be 500 characters or fewer.'); return }
    setSaving(true)
    const row = {
      name_key: company.toLowerCase(),
      display_name: company,
      description: description.trim() || null,
      logo_url: logoUrl.trim() || null,
      website_url: websiteUrl.trim() || null,
      hq_location: hqLocation.trim() || null,
      industry: industry || null,
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    }
    const { data, error: upErr } = await supabase
      .from('company_meta')
      .upsert(row, { onConflict: 'name_key' })
      .select('*')
      .single()
    setSaving(false)
    if (upErr) { setError(upErr.message); return }
    onSaved(data as CompanyMeta)
    toast('Company info saved.')
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); reset(); setOpen(true) }}
        className="text-xs font-medium text-primary hover:underline"
      >
        {hasMeta ? 'Edit company info' : '+ Add company info'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8 overflow-y-auto" onClick={() => setOpen(false)}>
          <div
            className="bg-surface rounded-2xl border border-border max-w-md w-full p-6"
            style={{ boxShadow: 'var(--shadow-modal)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-ink">Edit company info</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-ink-muted mb-4">
              Anyone who has posted under <strong className="text-ink">{company}</strong> can edit. Whoever saves last wins.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">Description <span className="text-ink-muted font-normal">(max 500)</span></label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <p className="text-[11px] text-ink-muted text-right mt-0.5">{description.length} / 500</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Logo URL</label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Website</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">HQ location</label>
                  <input
                    type="text"
                    value={hqLocation}
                    onChange={(e) => setHqLocation(e.target.value)}
                    placeholder="e.g. Carbondale, CO"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  >
                    <option value="">—</option>
                    {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint">
                  Cancel
                </button>
                <button type="button" disabled={saving} onClick={save} className="btn-gold px-4 py-2">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
