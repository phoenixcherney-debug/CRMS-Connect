import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ExternalLink, MapPin, Calendar, Trash2, MessageSquare, RotateCcw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { safeExternalHref } from '../lib/url'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import type { Application, ApplicationStatus } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'

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
  const toast = useToast()
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)
  // Audit task 14 — map of posterId → conversationId so each application
  // card can either deep-link to an existing thread or start a new one.
  const [convMap, setConvMap] = useState<Record<string, string>>({})
  const [openingConvFor, setOpeningConvFor] = useState<string | null>(null)
  // NAV-007 — decline-offer confirm.
  const [declineId, setDeclineId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)

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

      // Audit task 14 — build a posterId → conversationId map so the row
      // can render "Open conversation" without a per-row query.
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, participant_one, participant_two')
        .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)
      const map: Record<string, string> = {}
      for (const c of (convs ?? []) as { id: string; participant_one: string; participant_two: string }[]) {
        const other = c.participant_one === profile.id ? c.participant_two : c.participant_one
        map[other] = c.id
      }
      setConvMap(map)
    }
    setLoading(false)
  }

  async function openOrCreateConversation(otherId: string, firstName: string) {
    if (!profile || openingConvFor) return
    if (convMap[otherId]) {
      navigate(`/messages/${convMap[otherId]}`)
      return
    }
    setOpeningConvFor(otherId)
    const [p1, p2] = [profile.id, otherId].sort()
    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()
    setOpeningConvFor(null)
    if (error || !data) {
      toast(`Could not start a conversation with ${firstName}.`, { kind: 'error' })
      return
    }
    setConvMap((prev) => ({ ...prev, [otherId]: data.id }))
    navigate(`/messages/${data.id}`)
  }

  async function handleDecline(appId: string) {
    if (!profile) return
    setDecliningId(appId)
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('id', appId)
      .eq('applicant_id', profile.id)
    setDecliningId(null)
    setDeclineId(null)
    if (error) {
      toast('Could not decline the offer.', { kind: 'error' })
      return
    }
    setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'rejected' } : a))
    toast('Offer declined.')
  }

  async function handleWithdraw(appId: string) {
    if (!profile) return
    setWithdrawingId(appId)
    const { error } = await supabase.from('applications').delete().eq('id', appId).eq('applicant_id', profile.id)
    if (!error) {
      setApplications((prev) => prev.filter((a) => a.id !== appId))
      toast('Application withdrawn.')
    } else {
      toast('Could not withdraw the application.', { kind: 'error' })
    }
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
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Applications</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${applications.length} application${applications.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : fetchError ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">Failed to load your applications.</p>
          <button type="button"
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
            to="/opportunities"
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
                      to={`/opportunities/${job.id}`}
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
                    {(() => {
                      const safeHref = safeExternalHref(app.resume_link)
                      if (!safeHref) return null
                      return (
                        <a
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:text-primary-light"
                        >
                          <ExternalLink size={11} /> Resume/Portfolio
                        </a>
                      )
                    })()}
                    {(() => {
                      // Audit task 14 — Open conversation / Message <name>.
                      const poster = job.profiles as { id?: string; full_name?: string } | null
                      if (!poster?.id) return null
                      const firstName = poster.full_name?.trim().split(/\s+/)[0] || 'poster'
                      const conversationId = convMap[poster.id]
                      if (conversationId) {
                        return (
                          <Link
                            to={`/messages/${conversationId}`}
                            className="flex items-center gap-1 text-primary hover:text-primary-light font-medium"
                          >
                            <MessageSquare size={11} /> Open conversation
                          </Link>
                        )
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => openOrCreateConversation(poster.id!, firstName)}
                          disabled={openingConvFor === poster.id}
                          className="flex items-center gap-1 text-primary hover:text-primary-light font-medium disabled:opacity-50"
                        >
                          <MessageSquare size={11} />
                          {openingConvFor === poster.id ? 'Opening…' : `Message ${firstName}`}
                        </button>
                      )
                    })()}
                    {/* NAV-007 — destructive action varies per status. */}
                    {app.status === 'pending' && (
                      <button type="button"
                        onClick={() => handleWithdraw(app.id)}
                        disabled={withdrawingId === app.id}
                        className="flex items-center gap-1 text-error hover:text-error/80 font-medium disabled:opacity-50"
                      >
                        <Trash2 size={11} />
                        {withdrawingId === app.id ? 'Withdrawing…' : 'Withdraw application'}
                      </button>
                    )}
                    {app.status === 'accepted' && (
                      <button type="button"
                        onClick={() => setDeclineId(app.id)}
                        className="flex items-center gap-1 text-error hover:text-error/80 font-medium"
                      >
                        <Trash2 size={11} />
                        Decline offer
                      </button>
                    )}
                    {app.status === 'rejected' && job.is_active && (
                      <button
                        type="button"
                        onClick={async () => {
                          // NAV-007 — re-apply: drop the rejected row so
                          // the unique (job, applicant) constraint doesn't
                          // block a fresh submission, then send the user
                          // back to the opportunity to apply again.
                          if (!profile) return
                          const { error } = await supabase
                            .from('applications')
                            .delete()
                            .eq('id', app.id)
                            .eq('applicant_id', profile.id)
                          if (error) {
                            toast('Could not start re-application.', { kind: 'error' })
                            return
                          }
                          setApplications((prev) => prev.filter((a) => a.id !== app.id))
                          navigate(`/opportunities/${job.id}`)
                        }}
                        className="flex items-center gap-1 text-primary hover:text-primary-light font-medium"
                      >
                        <RotateCcw size={11} /> Re-apply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={declineId !== null}
        title="Decline this offer?"
        description="This will notify the employer that you're no longer accepting. You cannot undo this."
        confirmLabel={declineId && decliningId === declineId ? 'Declining…' : 'Yes, decline'}
        confirmDisabled={declineId !== null && decliningId === declineId}
        destructive
        onConfirm={() => declineId && handleDecline(declineId)}
        onCancel={() => { if (!decliningId) setDeclineId(null) }}
      />
    </div>
  )
}
