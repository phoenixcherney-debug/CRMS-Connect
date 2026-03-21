import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ExternalLink, User, Calendar, MessageSquare } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Application, ApplicationStatus, Job } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; classes: string; dot: string }> = {
  pending: { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  reviewed: { label: 'Under review', classes: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  accepted: { label: 'Accepted', classes: 'bg-success-bg text-success border-green-200', dot: 'bg-success' },
  rejected: { label: 'Not selected', classes: 'bg-error-bg text-error border-red-200', dot: 'bg-error' },
}

const STATUS_OPTIONS: ApplicationStatus[] = ['pending', 'reviewed', 'accepted', 'rejected']

export default function Applicants() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [{ data: jobData }, { data: appData }] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', id!).single(),
        supabase
          .from('applications')
          .select('*, profiles(id, full_name, graduation_year, bio, avatar_url, role)')
          .eq('job_id', id!)
          .order('created_at', { ascending: true }),
      ])

      setJob(jobData as Job)
      setApplications((appData as Application[]) ?? [])
      setLoading(false)
    }
    if (id) load()
  }, [id])

  async function updateStatus(appId: string, status: ApplicationStatus) {
    setUpdatingId(appId)
    setUpdateError(null)
    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', appId)
    if (error) {
      setUpdateError('Failed to update status. Please try again.')
    } else {
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a))
      )
    }
    setUpdatingId(null)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted">Listing not found.</p>
        <Link to="/my-postings" className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          ← My Postings
        </Link>
      </div>
    )
  }

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = applications.filter((a) => a.status === s).length
    return acc
  }, {} as Record<ApplicationStatus, number>)

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/jobs/${job.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6"
      >
        <ChevronLeft size={16} />
        Back to listing
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Applicants</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {job.title} · {job.company} ·{' '}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border border-border text-ink-secondary bg-primary-faint">
            {JOB_TYPE_LABELS[job.job_type]}
          </span>
        </p>
      </div>

      {/* Status summary */}
      {applications.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          {STATUS_OPTIONS.map((s) => {
            const cfg = STATUS_CONFIG[s]
            if (counts[s] === 0) return null
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${cfg.classes}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}: {counts[s]}
              </span>
            )
          })}
        </div>
      )}

      {updateError && (
        <div className="mb-4 rounded-lg bg-error-bg border border-red-200 px-4 py-3 text-sm text-error">
          {updateError}
        </div>
      )}

      {/* Applicant list */}
      {applications.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">No applications yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const applicant = app.profiles
            const isExpanded = expandedId === app.id
            const statusCfg = STATUS_CONFIG[app.status]
            const initials = applicant?.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) ?? '?'

            return (
              <div
                key={app.id}
                className="bg-surface rounded-xl border border-border p-5"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Applicant info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-primary text-sm font-bold shrink-0 overflow-hidden">
                      {applicant?.avatar_url ? (
                        <img
                          src={applicant.avatar_url}
                          alt={applicant.full_name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <p className="font-semibold text-ink">
                          {applicant?.full_name ?? 'Unknown'}
                        </p>
                        {applicant?.graduation_year && (
                          <span className="text-xs text-ink-muted">Class of {applicant.graduation_year}</span>
                        )}
                      </div>
                      {applicant?.bio && (
                        <p className="text-xs text-ink-secondary leading-relaxed line-clamp-1">{applicant.bio}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-muted">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          Applied {format(parseISO(app.created_at), 'MMM d, yyyy')}
                        </span>
                        {app.resume_link && (
                          <a
                            href={app.resume_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:text-primary-light"
                          >
                            <ExternalLink size={11} /> Resume/Portfolio
                          </a>
                        )}
                        {!app.resume_link && (
                          <span className="flex items-center gap-1 text-ink-muted/60">
                            <User size={11} /> No resume link
                          </span>
                        )}
                        {applicant && profile && (
                          <button
                            onClick={async () => {
                              const { data: existing } = await supabase
                                .from('conversations')
                                .select('id')
                                .or(
                                  `and(participant_one.eq.${profile.id},participant_two.eq.${applicant.id}),` +
                                  `and(participant_one.eq.${applicant.id},participant_two.eq.${profile.id})`
                                )
                                .maybeSingle()
                              if (existing) {
                                navigate(`/messages/${existing.id}`)
                                return
                              }
                              const [p1, p2] = [profile.id, applicant.id].sort()
                              const { data } = await supabase
                                .from('conversations')
                                .insert({ participant_one: p1, participant_two: p2 })
                                .select('id')
                                .single()
                              if (data) navigate(`/messages/${data.id}`)
                            }}
                            className="flex items-center gap-1 text-primary hover:text-primary-light font-medium"
                          >
                            <MessageSquare size={11} /> Message
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status selector */}
                  <div className="flex items-start gap-2 shrink-0">
                    <div className="relative">
                      <select
                        value={app.status}
                        disabled={updatingId === app.id}
                        onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
                        className={`pl-2.5 pr-7 py-1.5 rounded-lg text-xs font-medium border appearance-none cursor-pointer
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                          ${statusCfg.classes}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                      {updatingId === app.id && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <Spinner size="sm" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cover note */}
                {app.cover_note && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className={`text-sm text-ink-secondary leading-relaxed italic ${isExpanded ? '' : 'line-clamp-3'}`}>
                      "{app.cover_note}"
                    </p>
                    {app.cover_note.length > 200 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : app.id)}
                        className="mt-1.5 text-xs text-primary hover:text-primary-light font-medium"
                      >
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
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
