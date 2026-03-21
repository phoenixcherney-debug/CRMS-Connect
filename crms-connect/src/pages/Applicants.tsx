import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ExternalLink, User, Calendar, MessageSquare, X,
  CheckCircle2, Pin, PinOff, Edit3, Trash2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Application, ApplicationStatus, Job } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; classes: string; dot: string }> = {
  pending:  { label: 'Pending',      classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  reviewed: { label: 'Under review', classes: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-400'  },
  accepted: { label: 'Accepted',     classes: 'bg-success-bg text-success border-green-200', dot: 'bg-success'   },
  rejected: { label: 'Not selected', classes: 'bg-error-bg text-error border-red-200',       dot: 'bg-error'     },
}

const STATUS_OPTIONS: ApplicationStatus[] = ['pending', 'reviewed', 'accepted', 'rejected']

interface AcceptModal {
  appId: string
  applicantId: string
  applicantName: string
}

export default function Applicants() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Messaging
  const [messagingId, setMessagingId] = useState<string | null>(null)

  // Pin an applicant
  const [pinningId, setPinningId] = useState<string | null>(null)

  // Accept modal
  const [acceptModal, setAcceptModal] = useState<AcceptModal | null>(null)
  const [acceptNote, setAcceptNote] = useState('')
  const [accepting, setAccepting] = useState(false)

  // Post-accept suggestion banner
  const [showPostAccept, setShowPostAccept] = useState(false)

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

  // Sorted: pinned first, then by created_at
  const sortedApplications = [...applications].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return a.created_at.localeCompare(b.created_at)
  })

  async function togglePin(appId: string) {
    if (pinningId) return
    const app = applications.find((a) => a.id === appId)
    if (!app) return
    setPinningId(appId)
    const newVal = !app.is_pinned
    const { error } = await supabase
      .from('applications')
      .update({ is_pinned: newVal })
      .eq('id', appId)
    if (!error) {
      setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, is_pinned: newVal } : a))
    }
    setPinningId(null)
  }

  async function updateStatus(appId: string, status: ApplicationStatus) {
    if (status === 'accepted') {
      const app = applications.find((a) => a.id === appId)
      if (app) {
        setAcceptNote('')
        setAcceptModal({
          appId,
          applicantId: app.profiles?.id ?? '',
          applicantName: app.profiles?.full_name ?? 'the applicant',
        })
      }
      return
    }
    setUpdatingId(appId)
    const { error } = await supabase.from('applications').update({ status }).eq('id', appId)
    if (!error) {
      setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status } : a)))
    }
    setUpdatingId(null)
  }

  async function handleAccept() {
    if (!acceptModal || !profile || accepting) return
    if (!acceptNote.trim()) return
    setAccepting(true)

    const { appId, applicantId } = acceptModal

    const { error: statusErr } = await supabase
      .from('applications')
      .update({ status: 'accepted' })
      .eq('id', appId)

    if (statusErr) { setAccepting(false); return }

    setApplications((prev) => prev.map((a) => (a.id === appId ? { ...a, status: 'accepted' as ApplicationStatus } : a)))

    // Find or create conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${applicantId}),` +
        `and(participant_one.eq.${applicantId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    let convId = existing?.id
    if (!convId) {
      const [p1, p2] = [profile.id, applicantId].sort()
      const { data } = await supabase
        .from('conversations')
        .insert({ participant_one: p1, participant_two: p2 })
        .select('id')
        .single()
      convId = data?.id
    }

    if (convId) {
      const message = `You've been accepted for ${job?.title} at ${job?.company}!\n\n${acceptNote.trim()}`
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: profile.id,
        content: message,
        is_read: false,
      })
    }

    setAccepting(false)
    setAcceptModal(null)
    setAcceptNote('')
    setShowPostAccept(true)
  }

  async function messageApplicant(applicantId: string) {
    if (!profile || messagingId) return
    setMessagingId(applicantId)

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${applicantId}),` +
        `and(participant_one.eq.${applicantId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) { navigate(`/inbox/${existing.id}`); return }

    const [p1, p2] = [profile.id, applicantId].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()

    setMessagingId(null)
    if (data) navigate(`/inbox/${data.id}`)
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

  const acceptedCount = applications.filter((a) => a.status === 'accepted').length
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
          <span className="ml-2 text-ink-muted">
            · {acceptedCount} / {job.capacity} spot{job.capacity !== 1 ? 's' : ''} filled
          </span>
        </p>
      </div>

      {/* Post-accept suggestion banner */}
      {showPostAccept && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary-faint p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-ink">Applicant accepted!</p>
                <p className="text-xs text-ink-secondary mt-0.5">
                  You now have {acceptedCount} of {job.capacity} spot{job.capacity !== 1 ? 's' : ''} filled.
                  {acceptedCount >= job.capacity
                    ? ' All spots are filled — consider closing the listing.'
                    : ' What would you like to do next?'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowPostAccept(false)}
              className="p-1 text-ink-muted hover:text-ink hover:bg-white/60 rounded-lg transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 ml-7">
            <Link
              to={`/jobs/${job.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-light
                text-white text-xs font-medium transition-colors"
            >
              <Edit3 size={13} /> Edit spots available
            </Link>
            <Link
              to={`/jobs/${job.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border
                bg-surface hover:bg-red-50 text-error text-xs font-medium transition-colors"
            >
              <Trash2 size={13} /> View &amp; delete listing
            </Link>
          </div>
        </div>
      )}

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

      {/* Applicant list */}
      {applications.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">No applications yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedApplications.map((app, idx) => {
            const applicant = app.profiles
            const isExpanded = expandedId === app.id
            const statusCfg = STATUS_CONFIG[app.status]
            const initials = applicant?.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) ?? '?'

            // Divider between pinned and unpinned sections
            const prevApp = sortedApplications[idx - 1]
            const showDivider = idx > 0 && !app.is_pinned && prevApp?.is_pinned

            return (
              <div key={app.id}>
                {showDivider && (
                  <div className="flex items-center gap-3 my-1">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-ink-muted font-medium shrink-0">Other applicants</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                <div
                  className={`bg-surface rounded-xl border p-5 transition-all
                    ${app.is_pinned ? 'border-primary/40 shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-primary)_12%,transparent)]' : 'border-border'}`}
                  style={{ boxShadow: app.is_pinned ? undefined : 'var(--shadow-card)' }}
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
                          {app.is_pinned && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary-muted text-primary text-[10px] font-semibold">
                              <Pin size={9} /> Pinned
                            </span>
                          )}
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
                          {app.resume_link ? (
                            <a
                              href={app.resume_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:text-primary-light"
                            >
                              <ExternalLink size={11} /> Resume/Portfolio
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 text-ink-muted/60">
                              <User size={11} /> No resume link
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-start gap-2 shrink-0 flex-wrap">
                      {/* Pin button */}
                      <button
                        onClick={() => togglePin(app.id)}
                        disabled={pinningId === app.id}
                        title={app.is_pinned ? 'Unpin' : 'Pin to top'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed
                          ${app.is_pinned
                            ? 'bg-primary-muted border-primary/30 text-primary hover:bg-primary-faint'
                            : 'border-border text-ink-muted hover:bg-primary-faint hover:text-ink'
                          }`}
                      >
                        {pinningId === app.id
                          ? <Spinner size="sm" />
                          : app.is_pinned ? <PinOff size={12} /> : <Pin size={12} />
                        }
                        {app.is_pinned ? 'Unpin' : 'Pin'}
                      </button>

                      {/* Status dropdown */}
                      <div className="relative">
                        <select
                          value={app.status}
                          disabled={updatingId === app.id || app.status === 'accepted'}
                          onChange={(e) => updateStatus(app.id, e.target.value as ApplicationStatus)}
                          className={`pl-2.5 pr-7 py-1.5 rounded-lg text-xs font-medium border appearance-none cursor-pointer
                            disabled:opacity-60 disabled:cursor-not-allowed transition-colors
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

                      {/* Message button */}
                      <button
                        onClick={() => applicant && messageApplicant(applicant.id)}
                        disabled={messagingId === applicant?.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border
                          text-xs text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {messagingId === applicant?.id ? <Spinner size="sm" /> : <MessageSquare size={12} />}
                        Message
                      </button>
                    </div>
                  </div>

                  {/* Cover note */}
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
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Accept modal */}
      {acceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full"
            style={{ boxShadow: 'var(--shadow-modal)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-ink text-lg">Accept applicant</h3>
                <p className="text-sm text-ink-secondary mt-0.5">
                  Write a message to {acceptModal.applicantName} — they'll receive it in their inbox.
                </p>
              </div>
              <button
                onClick={() => { setAcceptModal(null); setAcceptNote('') }}
                disabled={accepting}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors ml-3 shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-ink mb-1.5">
                Message to {acceptModal.applicantName} <span className="text-error">*</span>
              </label>
              <textarea
                rows={5}
                value={acceptNote}
                onChange={(e) => setAcceptNote(e.target.value)}
                placeholder={`Hi ${acceptModal.applicantName.split(' ')[0]}, we'd love to have you join us…`}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder resize-none
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  transition-colors"
              />
              <p className="text-xs text-ink-muted mt-1.5">
                This message will be sent automatically with the acceptance notification.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                disabled={!acceptNote.trim() || accepting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-primary hover:bg-primary-light text-white font-medium text-sm
                  disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {accepting
                  ? <Spinner size="sm" className="border-white/30 border-t-white" />
                  : <CheckCircle2 size={15} />
                }
                {accepting ? 'Sending…' : 'Accept & send message'}
              </button>
              <button
                onClick={() => { setAcceptModal(null); setAcceptNote('') }}
                disabled={accepting}
                className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
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
