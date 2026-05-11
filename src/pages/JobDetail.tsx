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
import { friendlyError } from '../lib/errors'
import { validateExternalUrl, safeExternalHref } from '../lib/url'
import { sanitizeUserText } from '../lib/sanitize'
import { containsBlockedTerms } from '../lib/textFilter'
import type { Job, Application, ApplicationStatus, CustomQuestion } from '../types'
import { JOB_TYPE_LABELS, LOCATION_TYPE_LABELS, ROLE_LABELS } from '../types'

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; classes: string; dot: string }> = {
  pending:    { label: 'Submitted',    classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border', dot: 'bg-status-pending-dot' },
  reviewed:   { label: 'Submitted',   classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border', dot: 'bg-status-pending-dot' },
  accepted:   { label: 'Accepted',    classes: 'bg-status-accepted-bg text-status-accepted-text border-status-accepted-border', dot: 'bg-status-accepted-dot' },
  rejected:   { label: 'Not selected', classes: 'bg-status-rejected-bg text-status-rejected-text border-status-rejected-border', dot: 'bg-status-rejected-dot' },
  waitlisted: { label: 'Submitted',   classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border', dot: 'bg-status-pending-dot' },
  // P2-18 — intermediate hiring states.
  interview_scheduled:   { label: 'Interview scheduled', classes: 'bg-status-pending-bg text-status-pending-text border-status-pending-border', dot: 'bg-status-pending-dot' },
  offer_sent:            { label: 'Offer sent',          classes: 'bg-status-accepted-bg text-status-accepted-text border-status-accepted-border', dot: 'bg-status-accepted-dot' },
  started:               { label: 'Started',             classes: 'bg-status-accepted-bg text-status-accepted-text border-status-accepted-border', dot: 'bg-status-accepted-dot' },
  completed:             { label: 'Completed',           classes: 'bg-border text-ink-secondary border-border', dot: 'bg-status-reviewed-dot' },
  withdrawn_by_employer: { label: 'Withdrawn',           classes: 'bg-status-rejected-bg text-status-rejected-text border-status-rejected-border', dot: 'bg-status-rejected-dot' },
}
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import SaveJobButton from '../components/SaveJobButton'
import { useToast } from '../components/ToastProvider'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [myApplication, setMyApplication] = useState<Application | null>(null)

  // Apply modal state
  const [applying, setApplying] = useState(false)
  const [coverNote, setCoverNote] = useState('')
  const [coverNoteError, setCoverNoteError] = useState<string | null>(null)
  const [resumeLink, setResumeLink] = useState('')
  // P1-8 — optional PDF upload. Validated to PDF + 5 MB before submit;
  // server CHECK + bucket MIME allow-list back it up.
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeFileError, setResumeFileError] = useState<string | null>(null)
  // Phase 2.1 — when the student has a saved default resume, the apply form
  // reuses it unless they choose to upload a one-off file.
  const [useDefaultResume, setUseDefaultResume] = useState(true)
  // P1-7 — answers keyed by question text so the order matches what the
  // employer set. Required iff the question is non-blank.
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
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

  // Phase 3.6 — read typed questions when present, fall back to the legacy
  // string[] shape so old posts still render. (Migration 069 backfilled the
  // legacy rows, so this matters mainly for in-flight clients.)
  function resolveQuestions(j: Job | null): CustomQuestion[] {
    if (!j) return []
    const v2 = j.custom_questions_v2
    if (Array.isArray(v2) && v2.length > 0) return v2
    const legacy = j.custom_questions
    if (Array.isArray(legacy)) {
      return legacy
        .filter((s) => typeof s === 'string' && s.trim())
        .map((text) => ({ text: text!, type: 'short_text' as const, required: true }))
    }
    return []
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('jobs')
        .select('*, profiles!jobs_posted_by_fkey(id, full_name, role, graduation_year)')
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

  // S3.1 — per-opportunity tab title (Vite analogue of generateMetadata).
  useEffect(() => {
    if (job?.title) document.title = `${job.title} · CRMS Connect`
    return () => { document.title = 'CRMS Connect' }
  }, [job?.title])

  // P2-16 — log a view event when an authenticated non-owner lands on the
  // page. RLS rejects self-views so the employer's own reloads aren't
  // counted; we still skip the round-trip when we know it would 4xx.
  useEffect(() => {
    if (!job?.id || !profile?.id || profile.id === job.posted_by) return
    const source: 'explore' | 'opportunities' | 'student-posts' | 'feed' | 'direct' | 'saved' | 'employer' | 'notification' =
      (() => {
        const ref = document.referrer
        try {
          if (!ref) return 'direct'
          const path = new URL(ref).pathname
          if (path === '/explore') return 'explore'
          if (path.startsWith('/opportunities')) return 'opportunities'
          if (path.startsWith('/student-posts')) return 'student-posts'
          if (path.startsWith('/activity') || path.startsWith('/feed')) return 'feed'
          if (path.startsWith('/saved')) return 'saved'
          if (path.startsWith('/employers')) return 'employer'
          if (path.startsWith('/notifications')) return 'notification'
        } catch { /* ignore */ }
        return 'direct'
      })()
    void supabase.from('opportunity_views').insert({
      job_id: job.id,
      viewer_id: profile.id,
      source,
    })
    // Intentionally fire-and-forget — perf irrelevant, and RLS swallows
    // the rare race where viewer === owner.
    // Only log once per page load; deps keyed to job/profile id so a
    // refresh re-logs (matches industry "view = pageload" convention).
  }, [job?.id, job?.posted_by, profile?.id])

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
    const note = coverNote.trim()
    if (!note) {
      // Audit task 3 — inline field-level error + focus the textarea so
      // the user can see why submit didn't work, not just a banner above
      // the form.
      setCoverNoteError('Cover note is required.')
      document.getElementById('cover-note')?.focus()
      return
    }
    setCoverNoteError(null)

    // Audit task 2 — friendly error before the DB trigger raises.
    const cleanedNote = sanitizeUserText(note)
    if (cleanedNote.rejected) {
      setCoverNoteError(cleanedNote.reason ?? 'Cover note contains characters we don\'t allow.')
      return
    }
    // Task 1 — blocked-term filter on cover note.
    const term = containsBlockedTerms(cleanedNote.clean)
    if (term.blocked) {
      setCoverNoteError(term.reason ?? 'Please revise your cover note.')
      return
    }

    // Reject anything other than http(s) before it lands in the DB —
    // `javascript:` / `data:` URLs would otherwise render as a clickable
    // link in the applicant view (audit HIGH-7).
    const { safe: safeResumeLink, reason: resumeReason } = validateExternalUrl(resumeLink)
    if (resumeLink.trim() && !safeResumeLink) {
      setApplyError(resumeReason ?? 'Please enter a valid http(s) URL for your resume / portfolio.')
      return
    }

    // Phase 3.6 — typed questions: validate required-ness per the
    // poster's spec. We still snapshot the question text alongside each
    // answer so the row stays meaningful if the poster later edits the
    // questions.
    const questions = resolveQuestions(job)
    const answers: { question: string; answer: string }[] = []
    for (const q of questions) {
      const a = (customAnswers[q.text] ?? '').trim()
      if (!a && q.required) {
        setApplyError(`Please answer: "${q.text}"`)
        return
      }
      if (a) answers.push({ question: q.text, answer: a })
    }

    // P1-8 — validate the file up front. Server-side: bucket has a 5MB
    // cap and PDF-only MIME allow-list; column has a `\.pdf$` CHECK.
    if (resumeFile) {
      if (resumeFile.size > 5 * 1024 * 1024) {
        setResumeFileError('Resume PDF must be 5 MB or less.')
        return
      }
      if (resumeFile.type !== 'application/pdf' && !/\.pdf$/i.test(resumeFile.name)) {
        setResumeFileError('Resume must be a PDF.')
        return
      }
    }
    setResumeFileError(null)

    setApplyError(null)
    setApplyLoading(true)

    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_id: job.id,
        applicant_id: profile.id,
        cover_note: cleanedNote.clean,
        resume_link: safeResumeLink,
        custom_answers: answers,
        status: 'pending',
        // Phase 2.1 — snapshot the default resume path when the student
        // hasn't picked a one-off file. Storage RLS already lets the poster
        // read it once the application is accepted.
        resume_path: (!resumeFile && useDefaultResume && profile.default_resume_path)
          ? profile.default_resume_path
          : null,
      })
      .select()
      .single()

    if (error) {
      setApplyLoading(false)
      if (error.code === '23505') {
        setApplyError('You have already applied to this position.')
      } else {
        setApplyError(friendlyError(error, 'Could not submit your application. Please try again.'))
      }
      return
    }

    const created = data as Application
    // P1-8 — upload the PDF and patch resume_path. RLS on storage.objects
    // requires the row to exist + be owned by the applicant, so this has
    // to come after the INSERT above. Failures are toast-only — the
    // application itself already landed.
    if (resumeFile) {
      const safeName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
      const path = `resumes/${created.id}/${safeName.endsWith('.pdf') ? safeName : safeName + '.pdf'}`
      const { error: upErr } = await supabase.storage
        .from('resumes')
        .upload(path, resumeFile, { contentType: 'application/pdf', upsert: true })
      if (upErr) {
        toast('Application submitted, but the resume upload failed. Re-upload from your application later.', { kind: 'error' })
      } else {
        const { error: updErr } = await supabase
          .from('applications')
          .update({ resume_path: path })
          .eq('id', created.id)
        if (updErr) {
          toast('Resume uploaded but not linked. Try again from your application.', { kind: 'error' })
        } else {
          created.resume_path = path
        }
      }
    }

    setApplyLoading(false)
    setMyApplication(created)
    setApplySuccess(true)
    setApplying(false)

    // Notify the job poster (best-effort)
    if (job.posted_by) {
      sendPushToUser(
        job.posted_by,
        `New applicant for ${job.title}`,
        `${profile.full_name} just applied.`,
        `/opportunities/${job.id}/applicants`,
        'application_in',
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
    navigate('/my-opportunities')
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
        <Link to="/opportunities" className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          ← Back to Opportunities
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
        to="/opportunities"
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
                {/* Audit task 27 — render exactly one type chip. When the
                    poster picked "Other" and typed a free-text value, that
                    free-text becomes the chip. Otherwise the canonical
                    job_type label is the chip. The legacy opportunity_type
                    chip rendered alongside is gone. */}
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs border bg-surface border-border text-ink-secondary">
                  {job.job_type === 'other' && job.opportunity_type_other
                    ? job.opportunity_type_other
                    : JOB_TYPE_LABELS[job.job_type]}
                </span>
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

            {/* S3.7 — bookmark on detail (parity with cards). Students only. */}
            {profile?.role === 'student' && !isPoster && (
              <SaveJobButton jobId={job.id} size={16} />
            )}

            {/* Poster actions */}
            {isPoster && (
              <div className="flex gap-2">
                <Link
                  to={`/opportunities/${job.id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                    text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                >
                  <Edit3 size={14} /> Edit
                </Link>
                <button type="button"
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
              {/* P2-23 — match the card format ("Rolling" instead of
                  "Rolling — no deadline"). Card format already shipped in
                  the parallel commit. */}
              {deadline
                ? <>Deadline: {format(deadline, 'MMMM d, yyyy')}{expired && <span className="text-error font-medium ml-1">(Passed)</span>}</>
                : 'Rolling'}
            </span>
            {/* P2-36 — compensation, when set. */}
            {job.compensation && (
              <span className="flex items-center gap-1.5">
                <span className="text-ink-muted">$</span>{job.compensation}
              </span>
            )}
            {job.expected_weekly_hours && (
              <span className="flex items-center gap-1.5">
                <Clock size={14} /> {job.expected_weekly_hours}
              </span>
            )}
            {/* Audit task 12 — always show "Posted …". The previous gate on
                !expected_weekly_hours hid this line on any posting that had
                hours set, leading to inconsistent metadata rows. */}
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {job.created_at
                ? `Posted ${format(parseISO(job.created_at), 'MMMM d, yyyy')}`
                : 'Posted recently'}
            </span>
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
                {/* Audit task 16 — explicit spaces around the middot so the
                    byline always reads "Name · Role". */}
                <span className="text-ink-muted">{' · '}{ROLE_LABELS[job.profiles.role as import('../types').Role] ?? job.profiles.role}</span>
              </div>
              {/* Message button (shown to everyone except the poster themselves) */}
              {!isPoster && (
                <button type="button"
                  onClick={startConversation}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    border border-border text-sm text-ink-secondary hover:bg-primary-faint
                    hover:text-ink transition-colors"
                >
                  <MessageSquare size={14} />
                  Message {job.profiles.full_name.trim() || 'poster'}
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
            {/* Profile-completeness gate removed (audit pass 4 §2 Option A).
                Any authenticated student can apply directly. The "What was
                shared with the poster" panel below already shows what the
                poster will see (interests, grade, weekly availability). The
                old gate's link routed to /availability while the field it
                actually checked lived on /profile, which dead-ended new
                students. */}

        {applySuccess || myApplication ? (() => {
              const status = myApplication?.status ?? 'pending'
              const s = STATUS_CONFIG[status]
              const isRejected = status === 'rejected'
              const isAccepted = status === 'accepted'
              const bgClass = isRejected ? 'bg-error-bg border-status-rejected-border' : isAccepted ? 'bg-success-bg border-status-accepted-border' : 'bg-primary-faint border-border'
              const IconComponent = isRejected ? AlertCircle : CheckCircle2
              const iconClass = isRejected ? 'text-error' : isAccepted ? 'text-success' : 'text-primary'
              return (
                <div className="space-y-3">
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${bgClass}`}>
                    <IconComponent size={20} className={`${iconClass} shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {isRejected ? 'Application not selected' : isAccepted ? 'Application accepted!' : 'Application submitted'}
                      </p>
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${s.classes}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      {/* P1-5 — surface the employer's contact email after
                          acceptance (and only after). Privacy doc promises
                          this; previously it was nowhere in the UI. */}
                      {isAccepted && job.contact_email && (
                        <p className="text-xs text-ink-secondary mt-2">
                          Contact:{' '}
                          <a
                            href={`mailto:${job.contact_email}`}
                            className="text-primary hover:text-primary-light font-medium underline break-all"
                          >
                            {job.contact_email}
                          </a>
                        </p>
                      )}
                    </div>
                    {status === 'pending' && (
                      <button type="button"
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                        className="text-xs text-error hover:text-error/80 font-medium disabled:opacity-50"
                      >
                        {withdrawing ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    )}
                  </div>

                  {/* What was shared — shown right after a new submission */}
                  {applySuccess && (
                    <div className="rounded-xl border border-border bg-surface p-4 text-sm">
                      <p className="font-medium text-ink mb-3">What was shared with the poster</p>
                      <dl className="space-y-2">
                        {profile?.interests && profile.interests.length > 0 && (
                          <div className="flex gap-2">
                            <dt className="text-ink-muted w-36 shrink-0">Interests</dt>
                            <dd className="text-ink flex flex-wrap gap-1">
                              {profile.interests.map((i) => (
                                <span key={i} className="inline-flex px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">{i}</span>
                              ))}
                            </dd>
                          </div>
                        )}
                        {profile?.grade && (
                          <div className="flex gap-2">
                            <dt className="text-ink-muted w-36 shrink-0">Grade</dt>
                            <dd className="text-ink">{profile.grade}</dd>
                          </div>
                        )}
                        {profile?.weekly_availability && (
                          <div className="flex gap-2">
                            <dt className="text-ink-muted w-36 shrink-0">Weekly availability</dt>
                            <dd className="text-ink">{profile.weekly_availability}</dd>
                          </div>
                        )}
                        {coverNote.trim() && (
                          <div className="flex gap-2">
                            <dt className="text-ink-muted w-36 shrink-0">Cover note</dt>
                            <dd className="text-ink whitespace-pre-wrap">{coverNote.trim()}</dd>
                          </div>
                        )}
                        {(() => {
                          const safeHref = safeExternalHref(resumeLink)
                          if (!safeHref) return null
                          return (
                            <div className="flex gap-2">
                              <dt className="text-ink-muted w-36 shrink-0">Resume / Portfolio</dt>
                              <dd className="text-ink">
                                <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-light underline break-all">{safeHref}</a>
                              </dd>
                            </div>
                          )
                        })()}
                      </dl>
                    </div>
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
                  <label htmlFor="cover-note" className="block text-sm font-medium text-ink mb-1.5">
                    Cover note <span className="text-error">*</span>
                  </label>
                  <textarea
                    id="cover-note"
                    rows={4}
                    required
                    maxLength={2000}
                    value={coverNote}
                    onChange={(e) => { setCoverNote(e.target.value); if (coverNoteError) setCoverNoteError(null) }}
                    placeholder="Introduce yourself and explain why you're a great fit…"
                    aria-invalid={!!coverNoteError}
                    aria-describedby={coverNoteError ? 'cover-note-error' : undefined}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder resize-none
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                      transition-colors"
                  />
                  {coverNoteError && (
                    <p id="cover-note-error" role="alert" className="mt-1 text-xs text-error">
                      {coverNoteError}
                    </p>
                  )}
                </div>

                {/* Phase 3.6 — render typed questions. Required ones show a *. */}
                {resolveQuestions(job).map((q, idx) => (
                  <div key={`${idx}-${q.text}`}>
                    <label className="block text-sm font-medium text-ink mb-1.5">
                      {q.text} {q.required && <span className="text-error">*</span>}
                    </label>
                    {q.type === 'long_text' ? (
                      <textarea
                        rows={4}
                        maxLength={2000}
                        value={customAnswers[q.text] ?? ''}
                        onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.text]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    ) : q.type === 'single_select' ? (
                      <div className="space-y-1.5">
                        {(q.options ?? []).map((opt, oi) => (
                          <label key={oi} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border cursor-pointer hover:bg-primary-faint text-sm">
                            <input
                              type="radio"
                              name={`q-${idx}`}
                              value={opt}
                              checked={customAnswers[q.text] === opt}
                              onChange={() => setCustomAnswers((prev) => ({ ...prev, [q.text]: opt }))}
                              className="text-primary focus:ring-primary/30"
                            />
                            <span className="text-ink">{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        maxLength={500}
                        value={customAnswers[q.text] ?? ''}
                        onChange={(e) => setCustomAnswers((prev) => ({ ...prev, [q.text]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    )}
                  </div>
                ))}

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

                {/* P1-8 + Phase 2.1 — defaults to the student's saved
                    default resume when present. "Change" reveals the
                    per-application upload. */}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Resume PDF{' '}
                    <span className="text-ink-muted font-normal">(optional · 5 MB max)</span>
                  </label>
                  {profile?.default_resume_path && useDefaultResume ? (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-primary-faint text-sm">
                      <span className="text-ink-secondary">Using your default resume</span>
                      <button
                        type="button"
                        onClick={() => setUseDefaultResume(false)}
                        className="text-xs font-medium text-primary hover:text-primary-light"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null
                          setResumeFileError(null)
                          if (f && f.size > 5 * 1024 * 1024) {
                            setResumeFileError('Resume PDF must be 5 MB or less.')
                            e.target.value = ''
                            setResumeFile(null)
                            return
                          }
                          setResumeFile(f)
                        }}
                        className="block w-full text-sm text-ink-secondary file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-border file:text-sm file:font-medium file:bg-primary-faint file:text-primary hover:file:bg-primary-muted"
                      />
                      {resumeFileError && (
                        <p role="alert" className="mt-1 text-xs text-error">{resumeFileError}</p>
                      )}
                      {resumeFile && !resumeFileError && (
                        <p className="mt-1 text-xs text-ink-muted">
                          Selected: {resumeFile.name} ({(resumeFile.size / 1024).toFixed(0)} KB)
                        </p>
                      )}
                      {profile?.default_resume_path && (
                        <button
                          type="button"
                          onClick={() => { setUseDefaultResume(true); setResumeFile(null); setResumeFileError(null) }}
                          className="mt-1 text-xs font-medium text-primary hover:text-primary-light"
                        >
                          ← Use my default resume instead
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-3 pt-1">
                  {/* P2-32 — confirmation now happens in a modal (see
                      ConfirmDialog at the bottom of this page) so the
                      submit button keeps its label and a cover-note
                      preview is visible to the user before they commit. */}
                  {(
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          // Audit task 3 — clickable even when empty so the
                          // inline validation can surface the reason.
                          if (!coverNote.trim()) {
                            setCoverNoteError('Cover note is required.')
                            document.getElementById('cover-note')?.focus()
                            return
                          }
                          setCoverNoteError(null)
                          // P1-5 — validate the resume URL up front, before
                          // showing the confirmation step. The previous
                          // order-of-ops let users get to "Yes, submit"
                          // and only then bounce on bad input.
                          if (resumeLink.trim()) {
                            const { safe, reason } = validateExternalUrl(resumeLink)
                            if (!safe) {
                              setApplyError(reason ?? 'Please enter a valid http(s) URL for your resume / portfolio.')
                              return
                            }
                          }
                          setApplyError(null)
                          setConfirmApply(true)
                        }}
                        className="btn-gold flex-1"
                      >
                        Submit application
                      </button>
                      <button type="button"
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
              <button type="button"
                onClick={() => setApplying(true)}
                className="btn-gold w-full sm:w-auto px-6"
              >
                Apply now
              </button>
            )}
          </div>
        )}
      </div>

      {/* P2-32 — confirm submission via the shared dialog. Shows a cover-
          note preview so the user sees what they're about to send. */}
      <ConfirmDialog
        open={confirmApply}
        title="Submit this application?"
        description={`Once you submit, ${job?.profiles?.full_name ?? 'the poster'} can see your cover note and any resume link you provided. You can withdraw later if you change your mind.`}
        confirmLabel={applyLoading ? 'Submitting…' : 'Yes, submit'}
        confirmDisabled={applyLoading}
        onConfirm={() => { setConfirmApply(false); void handleApply() }}
        onCancel={() => { if (!applyLoading) setConfirmApply(false) }}
      >
        {coverNote.trim() && (
          <div className="mb-4 max-h-32 overflow-y-auto rounded-lg border border-border bg-primary-faint p-3 text-xs text-ink-secondary whitespace-pre-wrap">
            {coverNote.trim()}
          </div>
        )}
      </ConfirmDialog>

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
              <button type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-error hover:bg-error/90 text-white font-medium text-sm
                  disabled:opacity-50 transition-colors"
              >
                {deleteLoading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
                {deleteLoading ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button type="button"
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
