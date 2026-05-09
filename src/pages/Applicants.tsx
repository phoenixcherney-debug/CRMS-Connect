import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ExternalLink, User, Calendar, MessageSquare, CheckCircle2, X, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { safeExternalHref } from '../lib/url'
import { useAuth } from '../contexts/AuthContext'
import { sendPushToUser } from '../lib/sendPush'
import { useToast } from '../components/ToastProvider'
import type { Application, ApplicationStatus, Job, StudentSeeking, OpportunityType } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'

type Tab = 'inbox' | 'decided'

interface ApplicantProfile {
  id: string
  full_name: string
  graduation_year?: number | null
  bio?: string | null
  avatar_url?: string | null
  role: string
  interests: string[]
  weekly_availability: string | null
  student_seeking?: StudentSeeking | null
  grade?: string | null
  /** Audit M9 — student opt-in. False/missing means hide grade in EM views. */
  share_grade_with_employers?: boolean
}

/** Returns true if student's seeking aligns with the opportunity type */
function isCompatibleApplicant(job: Job, applicant: ApplicantProfile | null): boolean {
  if (!applicant) return true
  const seeking = applicant.student_seeking
  const oppType = job.opportunity_type as OpportunityType | null | undefined
  if (!seeking || !oppType) return true
  if (seeking === 'both' || seeking === 'other') return true
  if (oppType === 'job_internship' && seeking === 'job') return true
  if (oppType === 'mentorship' && seeking === 'mentor') return true
  if (oppType === 'volunteer' || oppType === 'shadow' || oppType === 'other') return true
  return false
}

const DECIDED_CONFIG: Record<'accepted' | 'rejected', { label: string; classes: string; dot: string }> = {
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
}

export default function Applicants() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const toast = useToast()

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // NAV-008 — default to whichever tab has rows. We'll re-pin once
  // applications load below.
  const [activeTab, setActiveTab] = useState<Tab>('inbox')
  const [tabPinned, setTabPinned] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setNotFound(false)

      // Load the job first so we can authorize before fetching applicants.
      // Non-owners (and non-admins) get a 404 — not 403, not an empty inbox —
      // so this URL doesn't leak job metadata or imply zero applications.
      const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id!).maybeSingle()
      const isOwner = !!profile && !!jobData && jobData.posted_by === profile.id
      const isAdmin = profile?.role === 'admin'
      if (!jobData || (!isOwner && !isAdmin)) {
        setJob(null)
        setApplications([])
        setNotFound(true)
        setLoading(false)
        return
      }

      const { data: appData } = await supabase
        .from('applications')
        .select('*, profiles!applications_applicant_id_fkey(id, full_name, graduation_year, bio, avatar_url, role, interests, weekly_availability, student_seeking, grade, share_grade_with_employers)')
        .eq('job_id', id!)
        .order('created_at', { ascending: true })

      setJob(jobData as Job)
      setApplications((appData as Application[]) ?? [])
      setLoading(false)
    }
    if (id) load()
  }, [id, profile])

  async function updateStatus(appId: string, status: ApplicationStatus) {
    setUpdatingId(appId)
    setUpdateError(null)
    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', appId)
    if (error) {
      setUpdateError('Failed to update status. Please try again.')
      toast('Could not update the application.', { kind: 'error' })
    } else {
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a))
      )
      // Audit task 6 — success toasts.
      if      (status === 'accepted') toast('Application accepted.')
      else if (status === 'rejected') toast('Application declined.')
      else if (status === 'pending')  toast('Decision reversed.')
      // Notify applicant of status update (best-effort)
      const app = applications.find((a) => a.id === appId)
      const applicantId = (app?.profiles as { id?: string } | null)?.id
      if (applicantId && job) {
        const STATUS_PUSH: Record<ApplicationStatus, string> = {
          pending:    'Your application has been submitted.',
          reviewed:   'Your application has been submitted.',
          waitlisted: 'Your application has been submitted.',
          accepted:   'Your application was accepted!',
          rejected:   'Your application was not selected.',
        }
        sendPushToUser(
          applicantId,
          `Application update: ${job.title}`,
          STATUS_PUSH[status],
          `/applications`
        )
      }
    }
    setUpdatingId(null)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (notFound || !job) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-ink mb-2" style={{ fontFamily: 'var(--font-serif)' }}>Page not found</h1>
        <p className="text-ink-muted">This opportunity doesn't exist or you don't have access to view its applicants.</p>
        <Link to="/my-opportunities" className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          ← My Opportunities
        </Link>
      </div>
    )
  }

  // Split inbox by compatibility: compatible first, then incompatible ("Other applicants")
  const allPending  = applications.filter((a) => a.status === 'pending')
  const compatible  = allPending.filter((a) => isCompatibleApplicant(job, a.profiles as ApplicantProfile | null))
  const incompatible = allPending.filter((a) => !isCompatibleApplicant(job, a.profiles as ApplicantProfile | null))

  const decided  = applications.filter((a) => a.status === 'accepted' || a.status === 'rejected')

  const inbox = allPending
  const tabApps = activeTab === 'inbox' ? inbox : decided

  // NAV-008 — first time we have data, switch to whichever tab has rows
  // so the page doesn't open on an empty Inbox while a decision sits
  // unread on Decided. Only fires once; the user can navigate freely
  // afterward.
  if (!tabPinned && !loading && applications.length > 0) {
    if (inbox.length === 0 && decided.length > 0) setActiveTab('decided')
    setTabPinned(true)
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'inbox',   label: 'New',     count: inbox.length   },
    { key: 'decided', label: 'Decided', count: decided.length },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/opportunities/${job.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6"
      >
        <ChevronLeft size={16} />
        Back to opportunity
      </Link>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Applicants</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {job.title} · {job.company} ·{' '}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border border-border text-ink-secondary bg-primary-faint">
            {JOB_TYPE_LABELS[job.job_type]}
          </span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {TABS.map(({ key, label, count }) => (
          <button type="button"
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            {label}
            {/* P2-30 — render the badge on every tab (even at 0) for
                consistency. The previous \`count > 0\` gate hid New=0
                while Decided=1 had a badge, which made New look broken. */}
            <span
              className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none ${
                activeTab === key
                  ? 'bg-primary text-white'
                  : 'bg-border text-ink-secondary'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {updateError && (
        <div className="mb-4 rounded-lg bg-error-bg border border-status-rejected-border px-4 py-3 text-sm text-error">
          {updateError}
        </div>
      )}

      {/* Applicant list */}
      {tabApps.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">
            {activeTab === 'inbox' ? 'No new applicants.' : 'No decisions made yet.'}
          </p>
        </div>
      ) : activeTab === 'inbox' ? (
        /* Inbox: compatible applicants first, then "Other applicants" dimmed */
        <div className="space-y-6">
          {compatible.length > 0 && (
            <div className="space-y-4">
              {compatible.map((app) => <ApplicantCard key={app.id} app={app} activeTab={activeTab} expandedId={expandedId} setExpandedId={setExpandedId} updatingId={updatingId} updateStatus={updateStatus} profile={profile} navigate={navigate} />)}
            </div>
          )}
          {incompatible.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Other applicants</p>
              <div className="space-y-4 opacity-60">
                {incompatible.map((app) => <ApplicantCard key={app.id} app={app} activeTab={activeTab} expandedId={expandedId} setExpandedId={setExpandedId} updatingId={updatingId} updateStatus={updateStatus} profile={profile} navigate={navigate} />)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tabApps.map((app) => <ApplicantCard key={app.id} app={app} activeTab={activeTab} expandedId={expandedId} setExpandedId={setExpandedId} updatingId={updatingId} updateStatus={updateStatus} profile={profile} navigate={navigate} />)}
        </div>
      )}
    </div>
  )
}

// ─── Applicant card sub-component ──────────────────────────────────────────────

interface CardProps {
  app: Application
  activeTab: Tab
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  updatingId: string | null
  updateStatus: (id: string, status: ApplicationStatus) => void
  profile: import('../types').Profile | null
  navigate: (path: string) => void
}

function ApplicantCard({ app, activeTab, expandedId, setExpandedId, updatingId, updateStatus, profile, navigate }: CardProps) {
  const applicant = app.profiles as ApplicantProfile | null
  // Audit M4 — two-step confirmation. Holds the action the user is about to
  // confirm. null = idle. 'accepted' | 'rejected' = waiting for the second
  // click. 'reverse' = on the Decided tab, waiting to flip back to pending.
  const [confirming, setConfirming] = useState<'accepted' | 'rejected' | 'reverse' | null>(null)
  const isExpanded = expandedId === app.id
  const isUpdating = updatingId === app.id
  const initials = applicant?.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'

  return (
    <div className="bg-surface rounded-xl border border-border p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
      {/* Top row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Applicant info — name + avatar link to /people/:id (audit task 13). */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Link
            to={applicant?.id ? `/people/${applicant.id}` : '#'}
            className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-primary text-sm font-bold shrink-0 overflow-hidden"
            aria-label={applicant?.full_name ? `View ${applicant.full_name}'s profile` : undefined}
          >
            {applicant?.avatar_url ? (
              <img src={applicant.avatar_url} alt={applicant.full_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <span>{initials}</span>
            )}
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              {applicant?.id ? (
                <Link to={`/people/${applicant.id}`} className="font-semibold text-ink hover:text-primary transition-colors">
                  {applicant.full_name ?? 'Unknown'}
                </Link>
              ) : (
                <p className="font-semibold text-ink">Unknown</p>
              )}
              {/* Audit M9 — only render grade if the student has opted in to
                  share it with employers/mentors. */}
              {applicant?.grade && applicant.share_grade_with_employers && (
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-border text-ink-secondary font-medium">{applicant.grade}</span>
              )}
              {applicant?.graduation_year && (!applicant.grade || !applicant.share_grade_with_employers) && (
                <span className="text-xs text-ink-muted">Class of {applicant.graduation_year}</span>
              )}
            </div>

            {/* Screening fields */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-ink-secondary">
              {applicant?.weekly_availability && (
                <span className="flex items-center gap-1"><Clock size={11} />Profile availability: {applicant.weekly_availability}</span>
              )}
              {applicant?.role === 'student' && !applicant.weekly_availability && (
                <span className="flex items-center gap-1 text-ink-muted/60"><Clock size={11} /> Profile availability not set</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Applied {format(parseISO(app.created_at), 'MMM d, yyyy')}
              </span>
              {(() => {
                const safeHref = safeExternalHref(app.resume_link)
                if (safeHref) {
                  return (
                    <a href={safeHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:text-primary-light">
                      <ExternalLink size={11} /> Resume/Portfolio
                    </a>
                  )
                }
                return (
                  <span className="flex items-center gap-1 text-ink-muted/60"><User size={11} /> No resume link</span>
                )
              })()}
              {applicant && profile && (
                <button type="button"
                  onClick={async () => {
                    const { data: existing } = await supabase
                      .from('conversations')
                      .select('id')
                      .or(`and(participant_one.eq.${profile.id},participant_two.eq.${applicant.id}),and(participant_one.eq.${applicant.id},participant_two.eq.${profile.id})`)
                      .maybeSingle()
                    if (existing) { navigate(`/messages/${existing.id}`); return }
                    const [p1, p2] = [profile.id, applicant.id].sort()
                    const { data } = await supabase.from('conversations').insert({ participant_one: p1, participant_two: p2 }).select('id').single()
                    if (data) navigate(`/messages/${data.id}`)
                  }}
                  className="flex items-center gap-1 text-primary hover:text-primary-light font-medium"
                >
                  <MessageSquare size={11} /> Message
                </button>
              )}
            </div>

            {/* Interests */}
            {applicant?.interests && applicant.interests.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {applicant.interests.map((interest) => (
                  <span key={interest} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary-muted text-primary">
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {activeTab === 'inbox' && confirming === null && (
            <div className="flex items-start gap-2">
              <button type="button"
                onClick={() => setConfirming('accepted')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-accepted-bg text-status-accepted-text border border-status-accepted-border hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isUpdating ? <Spinner size="sm" /> : <CheckCircle2 size={13} />}
                Accept
              </button>
              <button type="button"
                onClick={() => setConfirming('rejected')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-rejected-bg text-status-rejected-text border border-status-rejected-border hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                <X size={13} />
                Decline
              </button>
            </div>
          )}

          {activeTab === 'inbox' && confirming !== null && confirming !== 'reverse' && (
            <div className="flex items-start gap-2">
              <button type="button"
                onClick={() => { updateStatus(app.id, confirming); setConfirming(null) }}
                disabled={isUpdating}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-opacity disabled:opacity-40 ${
                  confirming === 'accepted'
                    ? 'bg-status-accepted-bg text-status-accepted-text border-status-accepted-border'
                    : 'bg-status-rejected-bg text-status-rejected-text border-status-rejected-border'
                }`}
              >
                {isUpdating ? <Spinner size="sm" /> : confirming === 'accepted' ? <CheckCircle2 size={13} /> : <X size={13} />}
                {confirming === 'accepted' ? 'Yes, accept' : 'Yes, decline'}
              </button>
              <button type="button"
                onClick={() => setConfirming(null)}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-ink-secondary hover:bg-primary-faint transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          )}

          {activeTab === 'decided' && (app.status === 'accepted' || app.status === 'rejected') && (
            <>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${DECIDED_CONFIG[app.status].classes}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${DECIDED_CONFIG[app.status].dot}`} />
                {DECIDED_CONFIG[app.status].label}
              </span>
              {/* Audit task 6 — Reverse decision now goes through the shared
                  ConfirmDialog so the affordance reads consistently with
                  Delete and other destructive flows. */}
              <button type="button"
                onClick={() => setConfirming('reverse')}
                className="text-[11px] text-ink-muted hover:text-ink underline transition-colors"
              >
                Reverse decision
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming === 'reverse'}
        title="Reverse this decision?"
        description={`This sends ${applicant?.full_name ?? 'the applicant'} back to your inbox as pending. They'll be notified about the change.`}
        confirmLabel={isUpdating ? 'Reversing…' : 'Yes, reverse'}
        confirmDisabled={isUpdating}
        onConfirm={() => { updateStatus(app.id, 'pending'); setConfirming(null) }}
        onCancel={() => setConfirming(null)}
      />

      {/* Cover note */}
      {app.cover_note && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className={`text-sm text-ink-secondary leading-relaxed italic ${isExpanded ? '' : 'line-clamp-3'}`}>
            "{app.cover_note}"
          </p>
          {app.cover_note.length > 200 && (
            <button type="button"
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
}
