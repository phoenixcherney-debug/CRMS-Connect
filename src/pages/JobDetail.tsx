import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin, Calendar, Building2, ExternalLink,
  MessageSquare, ChevronLeft, Edit3, Trash2, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sendPushToUser } from '../lib/sendPush'
import type { Job, Application, ApplicationStatus } from '../types'
import { JOB_TYPE_LABELS, LOCATION_TYPE_LABELS, OPPORTUNITY_TYPE_LABELS, ROLE_LABELS } from '../types'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; classes: string; dot: string }> = {
  pending:    { label: 'Pending review', classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border', dot: 'bg-status-pending-dot' },
  reviewed:   { label: 'Under review',  classes: 'bg-status-reviewed-bg text-status-reviewed-text border-status-reviewed-border', dot: 'bg-status-reviewed-dot' },
  accepted:   { label: 'Accepted',      classes: 'bg-status-accepted-bg text-status-accepted-text border-status-accepted-border', dot: 'bg-status-accepted-dot' },
  rejected:   { label: 'Not selected',  classes: 'bg-status-rejected-bg text-status-rejected-text border-status-rejected-border', dot: 'bg-status-rejected-dot' },
  // Students see waitlisted as pending — never expose the word "waitlisted" in student-facing UI
  waitlisted: { label: 'Pending review', classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border', dot: 'bg-status-pending-dot' },
}
import Spinner from '../components/Spinner'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [myApplication, setMyApplication] = useState<Application | null>(null)

  // Apply modal state
  const [applying, setApplying] = useState(false)
  const [coverNote, setCoverNote] = useState('')
  const [resumeLink, setResumeLink] = useState('')
  const [applyLoading, setApplyLoading] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applySuccess, setApplySuccess] = useState(false)
  const [confirmApply, setConfirmApply] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const isStudent = profile?.role === 'student'
  const isPoster = job?.posted_by === profile?.id

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('jobs')
        .select('*, profiles(id, full_name, role, graduation_year)')
        .eq('id', id!)
        .single()
      setJob(data as Job)

      if (profile?.role === 'student') {
        const { data: app } = await supabase
          .from('applications')
          .select('*')
          .eq('job_id', id!)
          .eq('applicant_id', profile.id)
          .maybeSingle()
        setMyApplication(app as Application)
      }

      setLoading(false)
    }
    if (id) load()
  }, [id, profile])

  async function startConversation() {
    if (!job?.posted_by || !profile) return
    // Check for existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${job.posted_by}),` +
        `and(participant_one.eq.${job.posted_by},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) {
      navigate(`/messages/${existing.id}`)
      return
    }

    // Normalize order so (A,B) and (B,A) always produce the same row
    const [p1, p2] = [profile.id, job.posted_by].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select()
      .single()

    if (data) navigate(`/messages/${data.id}`)
  }

  async function handleWithdraw() {
    if (!myApplication || !profile) return
    setWithdrawing(true)
    const { error } = await supabase
      .from('applications')
      .delete()
      .eq('id', myApplication.id)
      .eq('applicant_id', profile.id)
    setWithdrawing(false)
    if (!error) {
      setMyApplication(null)
      setApplySuccess(false)
      setCoverNote('')
      setResumeLink('')
    }
  }

  async function handleApply() {
    if (!profile || !job) return
    setApplyError(null)
    setApplyLoading(true)

    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_id: job.id,
        applicant_id: profile.id,
        cover_note: coverNote.trim(),
        resume_link: resumeLink.trim() || null,
        status: 'pending',
      })
      .select()
      .single()

    setApplyLoading(false)
    if (error) {
      if (error.code === '23505') {
        setApplyError('You have already applied to this position.')
      } else {
        setApplyError(error.message)
      }
      return
    }

    setMyApplication(data as Application)
    setApplySuccess(true)
    setApplying(false)

    // Notify the job poster (best-effort)
    if (job.posted_by) {
      sendPushToUser(
        job.posted_by,
        `New applicant for ${job.title}`,
        `${profile.full_name} just applied.`,
        `/jobs/${job.id}/applicants`
      )
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError(null)
    const { error } = await supabase.from('jobs').delete().eq('id', id!)
    setDeleteLoading(false)
    if (error) {
      setDeleteError('Failed to delete. Please try again.')
      return
    }
    navigate('/my-postings')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted">This opportunity could not be found.</p>
        <Link to="/jobs" className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          ← Back to Jobs
        </Link>
      </div>
    )
  }

  const deadline = job.deadline ? parseISO(job.deadline) : null
  const expired = deadline ? isPast(deadline) : false

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6"
      >
        <ChevronLeft size={16} />
        All opportunities
      </Link>

      {/* Main card */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-border">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border
                  ${expired || !job.is_active
                    ? 'bg-border/50 text-ink-muted border-border'
                    : 'bg-primary-muted text-primary border-primary-muted'
                  }`}>
                  {!job.is_active || expired ? 'Closed' : 'Active'}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
                  {JOB_TYPE_LABELS[job.job_type]}
                </span>
                {job.opportunity_type && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
                    {job.opportunity_type === 'other' && job.opportunity_type_other
                      ? job.opportunity_type_other
                      : OPPORTUNITY_TYPE_LABELS[job.opportunity_type]}
                  </span>
                )}
                {job.location_type && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
                    {LOCATION_TYPE_LABELS[job.location_type]}
                  </span>
                )}
                {job.industry && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
                    {job.industry}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>{job.title}</h1>
              <div className="flex items-center gap-1.5 mt-1 text-ink-secondary">
                <Building2 size={15} />
                <span className="font-medium">{job.company}</span>
              </div>
            </div>

            {/* Poster actions */}
            {isPoster && (
              <div className="flex gap-2">
                <Link
                  to={`/jobs/${job.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                    text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                >
                  <Edit3 size={14} /> Edit
                </Link>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-status-rejected-border
                    text-sm text-error hover:bg-error-bg transition-colors"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {job.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              {deadline
                ? <>Deadline: {format(deadline, 'MMMM d, yyyy')}{expired && <span className="text-error font-medium ml-1">(Passed)</span>}</>
                : 'Rolling — no deadline'}
            </span>
            {job.expected_weekly_hours && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {job.expected_weekly_hours}
              </span>
            )}
            {!job.expected_weekly_hours && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                Posted {format(parseISO(job.created_at), 'MMM d, yyyy')}
              </span>
            )}
            {(job.start_date || job.end_date) && (
              <span className="flex items-center gap-1.5">
                <Calendar size={14} />
                {job.start_date && job.end_date
                  ? `${format(parseISO(job.start_date), 'MMM d, yyyy')} – ${format(parseISO(job.end_date), 'MMM d, yyyy')}`
                  : job.start_date
                  ? `Starts ${format(parseISO(job.start_date), 'MMM d, yyyy')}`
                  : `Ends ${format(parseISO(job.end_date!), 'MMM d, yyyy')}`
                }
              </span>
            )}
          </div>

          {/* Posted by */}
          {job.profiles && (
            <div className="mt-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-muted flex items-center justify-center text-primary text-xs font-bold">
                {job.profiles.full_name.charAt(0)}
              </div>
              <div className="text-sm">
                <span className="font-medium text-ink">{job.profiles.full_name}</span>
                <span className="text-ink-muted ml-1.5">· {ROLE_LABELS[job.profiles.role as import('../types').Role] ?? job.profiles.role}</span>
              </div>
              {/* Message button (shown to everyone except the poster themselves) */}
              {!isPoster && (
                <button
                  onClick={startConversation}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    border border-border text-sm text-ink-secondary hover:bg-primary-faint
                    hover:text-ink transition-colors"
                >
                  <MessageSquare size={14} />
                  Message {job.profiles.full_name.split(' ')[0]}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <section>
            <h2 className="text-base font-semibold text-ink mb-3">Description</h2>
            <p className="text-ink-secondary leading-relaxed whitespace-pre-wrap text-sm">
              {job.description}
            </p>
          </section>

        </div>

        {/* Apply section — students only */}
        {isStudent && !isPoster && (
          <div className="px-6 sm:px-8 pb-8">
            {/* Profile completeness gate — shown if student hasn't filled in interests/availability */}
        {isStudent && !applySuccess && !myApplication && !expired && job.is_active &&
          (!(profile?.interests?.length) || !profile?.weekly_availability) && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-status-pending-border bg-status-pending-bg px-4 py-3">
            <AlertCircle size={16} className="text-status-pending-text shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-ink">Complete your profile before applying</p>
              <p className="text-ink-secondary mt-0.5">
                Please add your{' '}
                {!profile?.interests?.length && !profile?.weekly_availability
                  ? 'areas of interest and weekly availability'
                  : !profile?.interests?.length
                  ? 'areas of interest'
                  : 'weekly availability'}{' '}
                so this opportunity's poster can evaluate your fit.{' '}
                <Link to="/profile" className="text-primary font-medium hover:text-primary-light underline">
                  Update profile →
                </Link>
              </p>
            </div>
          </div>
        )}

        {applySuccess || myApplication ? (() => {
              const status = myApplication?.status ?? 'pending'
              const s = STATUS_CONFIG[status]
              const isRejected = status === 'rejected'
              const isAccepted = status === 'accepted'
              const bgClass = isRejected ? 'bg-error-bg border-status-rejected-border' : isAccepted ? 'bg-success-bg border-status-accepted-border' : 'bg-primary-faint border-border'
              const IconComponent = isRejected ? AlertCircle : CheckCircle2
              const iconClass = isRejected ? 'text-error' : isAccepted ? 'text-success' : 'text-primary'
              return (
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${bgClass}`}>
                  <IconComponent size={20} className={`${iconClass} shrink-0`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink">
                      {isRejected ? 'Application not selected' : isAccepted ? 'Application accepted!' : 'Application submitted'}
                    </p>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${s.classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                  </div>
                  {status === 'pending' && (
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing}
                      className="text-xs text-error hover:text-error/80 font-medium disabled:opacity-50"
                    >
                      {withdrawing ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  )}
                </div>
              )
            })() : expired || !job.is_active ? (
              <p className="text-sm text-ink-muted italic">
                This posting is no longer accepting applications.
              </p>
            ) : applying ? (
              <div className="rounded-xl border border-border p-5 space-y-4">
                <h3 className="font-semibold text-ink">Apply for {job.title}</h3>
                {applyError && (
                  <div className="flex items-start gap-2 rounded-lg bg-error-bg border border-status-rejected-border p-3 text-sm text-error">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    {applyError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Cover note <span className="text-error">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                    placeholder="Introduce yourself and explain why you're a great fit…"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder resize-none
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                      transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Resume / Portfolio link{' '}
                    <span className="text-ink-muted font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <ExternalLink
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"
                    />
                    <input
                      type="url"
                      value={resumeLink}
                      onChange={(e) => setResumeLink(e.target.value)}
                      placeholder="https://linkedin.com/in/you"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                        placeholder:text-ink-placeholder
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                        transition-colors"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  {confirmApply ? (
                    <>
                      <button
                        onClick={() => { setConfirmApply(false); handleApply() }}
                        disabled={applyLoading}
                        className="btn-gold flex-1"
                      >
                        {applyLoading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                        {applyLoading ? 'Submitting…' : 'Yes, submit'}
                      </button>
                      <button
                        onClick={() => setConfirmApply(false)}
                        className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                          hover:bg-primary-faint transition-colors"
                      >
                        Go back
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setConfirmApply(true)}
                        disabled={!coverNote.trim()}
                        className="btn-gold flex-1"
                      >
                        Submit application
                      </button>
                      <button
                        onClick={() => { setApplying(false); setApplyError(null) }}
                        className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                          hover:bg-primary-faint transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setApplying(true)}
                disabled={!profile?.interests?.length || !profile?.weekly_availability}
                className="btn-gold w-full sm:w-auto px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!profile?.interests?.length || !profile?.weekly_availability ? 'Complete your profile to apply' : undefined}
              >
                Apply now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <h3 className="font-semibold text-ink mb-2">Delete this posting?</h3>
            <p className="text-sm text-ink-secondary mb-5 leading-relaxed">
              This action is permanent. The opportunity and all applications will be removed.
            </p>
            {deleteError && (
              <p className="mb-3 text-sm text-error">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-error hover:bg-error/90 text-white font-medium text-sm
                  disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                {deleteLoading ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                  hover:bg-primary-faint transition-colors"
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
