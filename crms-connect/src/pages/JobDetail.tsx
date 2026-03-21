import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  MapPin, Calendar, Building2, Mail, ExternalLink,
  MessageSquare, ChevronLeft, Edit3, Trash2, AlertCircle, CheckCircle2, Clock,
  Share2, Search, X, Pin, PinOff, Users, AlertTriangle,
} from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Application, ApplicationStatus, Profile } from '../types'
import { JOB_TYPE_LABELS } from '../types'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; classes: string; dot: string }> = {
  pending: { label: 'Pending review', classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  reviewed: { label: 'Under review', classes: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400' },
  accepted: { label: 'Accepted', classes: 'bg-success-bg text-success border-green-200', dot: 'bg-success' },
  rejected: { label: 'Not selected', classes: 'bg-error-bg text-error border-red-200', dot: 'bg-error' },
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

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Withdraw application
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)

  // Pin state
  const [pinned, setPinned] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)

  // Share modal
  const [sharing, setSharing] = useState(false)
  const [shareSearch, setShareSearch] = useState('')
  const [sharePeople, setSharePeople] = useState<Profile[]>([])
  const [shareSending, setShareSending] = useState<string | null>(null)
  const [shareSent, setShareSent] = useState<Set<string>>(new Set())

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

      if (profile) {
        const { data: pin } = await supabase
          .from('pinned_jobs')
          .select('id')
          .eq('job_id', id!)
          .eq('user_id', profile.id)
          .maybeSingle()
        setPinned(!!pin)
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
      navigate(`/inbox/${existing.id}`)
      return
    }

    // Normalize order so (A,B) and (B,A) always produce the same row
    const [p1, p2] = [profile.id, job.posted_by].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select()
      .single()

    if (data) navigate(`/inbox/${data.id}`)
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
  }

  async function openShare() {
    setShareSearch('')
    setShareSent(new Set())
    setSharing(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url, graduation_year')
      .eq('onboarding_complete', true)
      .neq('id', profile?.id ?? '')
      .order('full_name')
    setSharePeople((data as Profile[]) ?? [])
  }

  async function shareWith(person: Profile) {
    if (!profile || !job || shareSending) return
    setShareSending(person.id)

    // Find or create conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${person.id}),` +
        `and(participant_one.eq.${person.id},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    let convId = existing?.id
    if (!convId) {
      const [p1, p2] = [profile.id, person.id].sort()
      const { data } = await supabase
        .from('conversations')
        .insert({ participant_one: p1, participant_two: p2 })
        .select('id')
        .single()
      convId = data?.id
    }

    if (convId) {
      const card = JSON.stringify({
        type: 'job_share',
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        job_type: job.job_type,
        deadline: job.deadline,
      })
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: profile.id,
        content: card,
        is_read: false,
      })
      setShareSent((prev) => new Set(prev).add(person.id))
    }

    setShareSending(null)
  }

  async function togglePin() {
    if (!profile || pinLoading) return
    setPinLoading(true)
    if (pinned) {
      await supabase.from('pinned_jobs').delete().eq('job_id', id!).eq('user_id', profile.id)
      setPinned(false)
    } else {
      await supabase.from('pinned_jobs').insert({ job_id: id!, user_id: profile.id })
      setPinned(true)
    }
    setPinLoading(false)
  }

  async function handleDelete() {
    setDeleteLoading(true)
    await supabase.from('jobs').delete().eq('id', id!)
    navigate('/my-postings')
  }

  async function withdrawApplication() {
    if (!myApplication) return
    setWithdrawLoading(true)
    const { error } = await supabase.from('applications').delete().eq('id', myApplication.id)
    if (!error) {
      setMyApplication(null)
      setApplySuccess(false)
    }
    setWithdrawLoading(false)
    setConfirmWithdraw(false)
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
        <p className="text-ink-muted">This listing could not be found.</p>
        <Link to="/jobs" className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          ← Back to Jobs
        </Link>
      </div>
    )
  }

  const deadline = parseISO(job.deadline)
  const expired = isPast(deadline)

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
              </div>
              <h1 className="text-2xl font-bold text-ink">{job.title}</h1>
              <div className="flex items-center gap-1.5 mt-1 text-ink-secondary">
                <Building2 size={15} />
                <span className="font-medium">{job.company}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={togglePin}
                disabled={pinLoading}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${pinned
                    ? 'bg-primary-muted border-primary/30 text-primary hover:bg-primary-faint'
                    : 'border-border text-ink-secondary hover:bg-primary-faint hover:text-ink'
                  }`}
              >
                {pinned ? <PinOff size={14} /> : <Pin size={14} />}
                {pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                onClick={openShare}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                  text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
              >
                <Share2 size={14} /> Share
              </button>
              {isPoster && (
                <>
                  <Link
                    to={`/jobs/${job.id}/applicants`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                      text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                  >
                    <Users size={14} /> Applicants
                  </Link>
                  <Link
                    to={`/jobs/${job.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                      text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                  >
                    <Edit3 size={14} /> Edit
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
                      text-sm text-error hover:bg-error-bg transition-colors"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {job.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={14} />
              Deadline: {format(deadline, 'MMMM d, yyyy')}
              {expired && <span className="text-error font-medium ml-1">(Passed)</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              Posted {format(parseISO(job.created_at), 'MMM d, yyyy')}
            </span>
            <span className="flex items-center gap-1.5">
              <Mail size={14} /> {job.contact_email}
            </span>
            <span className="flex items-center gap-1.5">
              <Users size={14} />
              {job.capacity} spot{job.capacity !== 1 ? 's' : ''}
              {isStudent && (
                <span className="ml-1 text-xs text-ink-muted">
                  · {job.applicant_count} applied
                </span>
              )}
            </span>
          </div>

          {/* Posted by */}
          {job.profiles && (
            <div className="mt-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-muted flex items-center justify-center text-primary text-xs font-bold">
                {job.profiles.full_name.charAt(0)}
              </div>
              <div className="text-sm">
                <span className="font-medium text-ink">{job.profiles.full_name}</span>
                <span className="text-ink-muted ml-1.5 capitalize">· {job.profiles.role}</span>
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

          {job.required_skills && (
            <section>
              <h2 className="text-base font-semibold text-ink mb-3">Required skills / classes</h2>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.split(',').map((skill) => skill.trim()).filter(Boolean).map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-lg bg-primary-faint border border-primary/20 text-primary text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Apply section — students only */}
        {isStudent && !isPoster && (
          <div className="px-6 sm:px-8 pb-8">
            {applySuccess || myApplication ? (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-success-bg border border-green-200">
                <CheckCircle2 size={20} className="text-success shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">Application submitted!</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    {(() => {
                      const s = STATUS_CONFIG[myApplication?.status ?? 'pending']
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${s.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      )
                    })()}
                    {myApplication && myApplication.status !== 'accepted' && (
                      <button
                        onClick={() => setConfirmWithdraw(true)}
                        className="text-xs text-ink-muted hover:text-error transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={11} /> Withdraw
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : expired || !job.is_active ? (
              <p className="text-sm text-ink-muted italic">
                This posting is no longer accepting applications.
              </p>
            ) : applying ? (
              <div className="rounded-xl border border-border p-5 space-y-4">
                <h3 className="font-semibold text-ink">Apply for {job.title}</h3>
                {applyError && (
                  <div className="flex items-start gap-2 rounded-lg bg-error-bg border border-red-200 p-3 text-sm text-error">
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
                  <button
                    onClick={handleApply}
                    disabled={!coverNote.trim() || applyLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                      bg-primary hover:bg-primary-light text-white font-medium text-sm
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {applyLoading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                    {applyLoading ? 'Submitting…' : 'Submit application'}
                  </button>
                  <button
                    onClick={() => { setApplying(false); setApplyError(null) }}
                    className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                      hover:bg-primary-faint transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setApplying(true)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-light
                  text-white font-medium text-sm transition-colors"
              >
                Apply now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Share modal */}
      {sharing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-surface rounded-2xl border border-border w-full max-w-sm" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-semibold text-ink">Share opportunity</h3>
              <button
                onClick={() => setSharing(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="px-5 pb-3 text-xs text-ink-secondary">
              Send <span className="font-medium text-ink">{job.title}</span> to someone on CRMS Connect.
            </p>
            {/* Search */}
            <div className="px-5 pb-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                <input
                  type="text"
                  value={shareSearch}
                  onChange={(e) => setShareSearch(e.target.value)}
                  placeholder="Search by name…"
                  autoFocus
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    transition-colors"
                />
              </div>
            </div>
            {/* People list */}
            <div className="overflow-y-auto max-h-64 px-2 pb-4">
              {sharePeople.length === 0 ? (
                <p className="text-center text-sm text-ink-muted py-6">Loading…</p>
              ) : (() => {
                const filtered = sharePeople.filter((p) =>
                  p.full_name.toLowerCase().includes(shareSearch.toLowerCase())
                )
                return filtered.length === 0 ? (
                  <p className="text-center text-sm text-ink-muted py-6">No results</p>
                ) : filtered.map((person) => {
                  const sent = shareSent.has(person.id)
                  const sending = shareSending === person.id
                  return (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary-faint transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-muted flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {person.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{person.full_name}</p>
                        <p className="text-xs text-ink-muted capitalize">{person.role}</p>
                      </div>
                      <button
                        onClick={() => !sent && shareWith(person)}
                        disabled={sending || sent}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                          ${sent
                            ? 'bg-success-bg text-success border border-green-200 cursor-default'
                            : 'bg-primary hover:bg-primary-light text-white disabled:opacity-60 disabled:cursor-not-allowed'
                          }`}
                      >
                        {sending ? (
                          <Spinner size="sm" className="border-white/30 border-t-white" />
                        ) : sent ? (
                          <CheckCircle2 size={12} />
                        ) : null}
                        {sent ? 'Sent' : 'Send'}
                      </button>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Withdraw confirmation modal */}
      {confirmWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-ink">Withdraw application?</h3>
                <p className="text-sm text-ink-secondary mt-1 leading-relaxed">
                  This will permanently remove your application. You can reapply later if the listing is still open.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={withdrawApplication}
                disabled={withdrawLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-error hover:bg-red-700 text-white font-medium text-sm
                  disabled:opacity-50 transition-colors"
              >
                {withdrawLoading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                {withdrawLoading ? 'Withdrawing…' : 'Yes, withdraw'}
              </button>
              <button
                onClick={() => setConfirmWithdraw(false)}
                disabled={withdrawLoading}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary
                  hover:bg-primary-faint transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <h3 className="font-semibold text-ink mb-2">Delete this posting?</h3>
            <p className="text-sm text-ink-secondary mb-5 leading-relaxed">
              This action is permanent. The listing and all applications will be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-error hover:bg-red-700 text-white font-medium text-sm
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
