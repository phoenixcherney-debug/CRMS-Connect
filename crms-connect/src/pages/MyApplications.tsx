import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, MapPin, Calendar, Trash2, X } from 'lucide-react'
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
    label: 'Pending review',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-400',
  },
  reviewed: {
    label: 'Under review',
    classes: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-400',
  },
  accepted: {
    label: 'Accepted',
    classes: 'bg-success-bg text-success border-green-200',
    dot: 'bg-success',
  },
  rejected: {
    label: 'Not selected',
    classes: 'bg-error-bg text-error border-red-200',
    dot: 'bg-error',
  },
}

export default function MyApplications() {
  const { profile } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null) // app id
  const [withdrawing, setWithdrawing] = useState(false)

  async function withdrawApplication(appId: string) {
    setWithdrawing(true)
    const { error } = await supabase.from('applications').delete().eq('id', appId)
    if (!error) {
      setApplications((prev) => prev.filter((a) => a.id !== appId))
    }
    setWithdrawing(false)
    setConfirmWithdraw(null)
  }

  useEffect(() => {
    async function load() {
      if (!profile) return
      const { data } = await supabase
        .from('applications')
        .select(`
          *,
          jobs(id, title, company, location, job_type, deadline, is_active,
            profiles(id, full_name))
        `)
        .eq('applicant_id', profile.id)
        .order('created_at', { ascending: false })
      setApplications((data as Application[]) ?? [])
      setLoading(false)
    }
    load()
  }, [profile?.id])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">My Applications</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${applications.length} application${applications.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : applications.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted mb-3">You haven't applied to any opportunities yet.</p>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
              bg-primary hover:bg-primary-light text-white font-medium text-sm transition-colors"
          >
            Browse opportunities →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const job = app.jobs
            if (!job) return null
            const deadline = parseISO(job.deadline)
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
                      <Calendar size={11} /> Deadline: {format(deadline, 'MMM d, yyyy')}
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

                {/* Right side: status + links + withdraw */}
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
                  </div>

                  {app.status !== 'accepted' && (
                    <button
                      onClick={() => setConfirmWithdraw(app.id)}
                      className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-error transition-colors"
                    >
                      <Trash2 size={11} /> Withdraw
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Withdraw confirmation modal */}
      {confirmWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-ink">Withdraw application?</h3>
              <button onClick={() => setConfirmWithdraw(null)} className="p-1 text-ink-muted hover:text-ink hover:bg-primary-faint rounded-lg transition-colors">
                <X size={15} />
              </button>
            </div>
            <p className="text-sm text-ink-secondary mb-5 leading-relaxed">
              This will permanently remove your application. You can reapply later if the listing is still open.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => withdrawApplication(confirmWithdraw)}
                disabled={withdrawing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-error hover:bg-red-700 text-white font-medium text-sm
                  disabled:opacity-50 transition-colors"
              >
                {withdrawing ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
              </button>
              <button
                onClick={() => setConfirmWithdraw(null)}
                disabled={withdrawing}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                  hover:bg-primary-faint transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
