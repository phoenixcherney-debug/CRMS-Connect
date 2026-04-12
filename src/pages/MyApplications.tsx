import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, MapPin, Calendar, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Application, ApplicationStatus } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; classes: string; dot: string }
> = {
  pending: {
    label: 'Submitted',
    classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border',
    dot: 'bg-status-pending-dot',
  },
  reviewed: {
    label: 'Submitted',
    classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border',
    dot: 'bg-status-pending-dot',
  },
  accepted: {
    label: 'Accepted',
    classes: 'bg-status-accepted-bg text-status-accepted-text border-status-accepted-border',
    dot: 'bg-status-accepted-dot',
  },
  rejected: {
    label: 'Not selected',
    classes: 'bg-status-rejected-bg text-status-rejected-text border-status-rejected-border',
    dot: 'bg-status-rejected-dot',
  },
  waitlisted: {
    label: 'Submitted',
    classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border',
    dot: 'bg-status-pending-dot',
  },
}

export default function MyApplications() {
  const { profile } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  async function load() {
    if (!profile) return
    setFetchError(false)
    const { data, error } = await supabase
      .from('applications')
      .select(`
        *,
        jobs(id, title, company, location, job_type, deadline, is_active,
          profiles(id, full_name))
      `)
      .eq('applicant_id', profile.id)
      .order('created_at', { ascending: false })
    if (error) {
      setFetchError(true)
    } else {
      setApplications((data as Application[]) ?? [])
    }
    setLoading(false)
  }

  async function handleWithdraw(appId: string) {
    if (!profile) return
    setWithdrawingId(appId)
    const { error } = await supabase.from('applications').delete().eq('id', appId).eq('applicant_id', profile.id)
    if (!error) setApplications((prev) => prev.filter((a) => a.id !== appId))
    setWithdrawingId(null)
  }

  useEffect(() => {
    load()

    // Subscribe to status changes on the user's applications
    if (!profile) return
    const channel = supabase
      .channel('my-applications-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `applicant_id=eq.${profile.id}`,
        },
        () => load()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>My Applications</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${applications.length} application${applications.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">Failed to load your applications.</p>
          <button
            onClick={() => load()}
            className="mt-3 text-sm text-primary hover:text-primary-light font-medium"
          >
            Try again
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted mb-3">You haven't applied to any opportunities yet.</p>
          <Link
            to="/jobs"
            className="btn-gold"
          >
            Browse opportunities →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const job = app.jobs
            if (!job) return null
            const deadline = job.deadline ? parseISO(job.deadline) : null
            const status = STATUS_CONFIG[app.status]

            return (
              <div
                key={app.id}
                className="bg-surface rounded-xl border border-border p-4 sm:p-5 flex flex-col sm:flex-row gap-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                {/* Job info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-1">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="font-semibold text-ink hover:text-primary transition-colors"
                    >
                      {job.title}
                    </Link>
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border border-border text-ink-secondary bg-primary-faint">
                      {JOB_TYPE_LABELS[job.job_type]}
                    </span>
                  </div>
                  <p className="text-sm text-ink-secondary">{job.company}</p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {deadline ? `Deadline: ${format(deadline, 'MMM d, yyyy')}` : 'Rolling'}
                    </span>
                    {job.profiles && (
                      <span>Posted by {job.profiles.full_name}</span>
                    )}
                  </div>

                  {/* Cover note preview */}
                  <p className="mt-3 text-xs text-ink-secondary leading-relaxed line-clamp-2 italic">
                    "{app.cover_note}"
                  </p>
                </div>

                {/* Right side: status + links */}
                <div className="flex sm:flex-col items-start gap-3 sm:items-end shrink-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${status.classes}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>

                  <div className="flex flex-col gap-1.5 text-xs text-ink-muted">
                    <span>Applied {format(parseISO(app.created_at), 'MMM d, yyyy')}</span>
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
                    {app.status === 'pending' && (
                      <button
                        onClick={() => handleWithdraw(app.id)}
                        disabled={withdrawingId === app.id}
                        className="flex items-center gap-1 text-error hover:text-error/80 font-medium disabled:opacity-50"
                      >
                        <Trash2 size={11} />
                        {withdrawingId === app.id ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
