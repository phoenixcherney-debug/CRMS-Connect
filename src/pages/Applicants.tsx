import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, ExternalLink, User, Calendar, MessageSquare, CheckCircle2, X, Clock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sendPushToUser } from '../lib/sendPush'
import type { Application, ApplicationStatus, Job, StudentSeeking, OpportunityType } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

type Tab = 'inbox' | 'waitlist' | 'decided'

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

  const [job, setJob] = useState<Job | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('inbox')

  useEffect(() => {
    async function load() {
      setLoading(true)

      const [{ data: jobData }, { data: appData }] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', id!).single(),
        supabase
          .from('applications')
          .select('*, profiles(id, full_name, graduation_year, bio, avatar_url, role, interests, weekly_availability, student_seeking, grade)')
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
      // Notify applicant of status update (best-effort)
      const app = applications.find((a) => a.id === appId)
      const applicantId = (app?.profiles as { id?: string } | null)?.id
      if (applicantId && job) {
        const STATUS_PUSH: Record<ApplicationStatus, string> = {
          pending:    'Your application is pending review.',
          reviewed:   'Your application is under review.',
          waitlisted: "You've been added to the waitlist.",
          accepted:   'Your application was accepted!',
          rejected:   'Your application was not selected.',
        }
        sendPushToUser(
          applicantId,
          `Application update: ${job.title}`,
          STATUS_PUSH[status],
          `/my-applications`
        )
      }
    }
    setUpdatingId(null)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!job) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted">Opportunity not found.</p>
        <Link to="/my-postings" className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          ← My Postings
        </Link>
      </div>
    )
  }

  // Split inbox by compatibility: compatible first, then incompatible ("Other applicants")
  const allPending  = applications.filter((a) => a.status === 'pending')
  const compatible  = allPending.filter((a) => isCompatibleApplicant(job, a.profiles as ApplicantProfile | null))
  const incompatible = allPending.filter((a) => !isCompatibleApplicant(job, a.profiles as ApplicantProfile | null))

  const waitlist = applications.filter((a) => a.status === 'waitlisted')
  const decided  = applications.filter((a) => a.status === 'accepted' || a.status === 'rejected')

  const inbox = allPending
  const tabApps = activeTab === 'inbox' ? inbox : activeTab === 'waitlist' ? waitlist : decided

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'inbox',    label: 'Inbox',    count: inbox.length    },
    { key: 'waitlist', label: 'Waitlist', count: waitlist.length },
    { key: 'decided',  label: 'Decided',  count: decided.length  },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/jobs/${job.id}`}
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
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-secondary hover:text-ink'
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-none ${
                  activeTab === key
                    ? 'bg-primary text-white'
                    : 'bg-border text-ink-secondary'
                }`}
              >
                {count}
              </span>
            )}
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
            {activeTab === 'inbox'
              ? 'No new applicants.'
              : activeTab === 'waitlist'
              ? 'No one on the waitlist.'
              : 'No decisions made yet.'}
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
  const isExpanded = expandedId === app.id
  const isUpdating = updatingId === app.id
  const initials = applicant?.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?'

  return (
    <div className="bg-surface rounded-xl border border-border p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
      {/* Top row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Applicant info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-primary text-sm font-bold shrink-0 overflow-hidden">
            {applicant?.avatar_url ? (
              <img src={applicant.avatar_url} alt={applicant.full_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <p className="font-semibold text-ink">{applicant?.full_name ?? 'Unknown'}</p>
              {applicant?.grade && (
                <span className="text-xs px-1.5 py-0.5 rounded-md bg-border text-ink-secondary font-medium">{applicant.grade}</span>
              )}
              {applicant?.graduation_year && !applicant.grade && (
                <span className="text-xs text-ink-muted">Class of {applicant.graduation_year}</span>
              )}
            </div>

            {/* Screening fields */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-ink-secondary">
              {applicant?.weekly_availability && (
                <span className="flex items-center gap-1"><Clock size={11} />{applicant.weekly_availability}</span>
              )}
              {applicant?.role === 'student' && !applicant.weekly_availability && (
                <span className="flex items-center gap-1 text-ink-muted/60"><Clock size={11} /> Availability not set</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Applied {format(parseISO(app.created_at), 'MMM d, yyyy')}
              </span>
              {app.resume_link && (
                <a href={app.resume_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:text-primary-light">
                  <ExternalLink size={11} /> Resume/Portfolio
                </a>
              )}
              {!app.resume_link && (
                <span className="flex items-center gap-1 text-ink-muted/60"><User size={11} /> No resume link</span>
              )}
              {applicant && profile && (
                <button
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
        <div className="flex items-start gap-2 shrink-0">
          {(activeTab === 'inbox' || activeTab === 'waitlist') && (
            <>
              <button
                onClick={() => updateStatus(app.id, 'accepted')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-accepted-bg text-status-accepted-text border border-status-accepted-border hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                {isUpdating ? <Spinner size="sm" /> : <CheckCircle2 size={13} />}
                Accept
              </button>
              {activeTab === 'inbox' && (
                <button
                  onClick={() => updateStatus(app.id, 'waitlisted')}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-pending-bg text-status-pending-text border border-status-pending-border hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  Waitlist
                </button>
              )}
              <button
                onClick={() => updateStatus(app.id, 'rejected')}
                disabled={isUpdating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-rejected-bg text-status-rejected-text border border-status-rejected-border hover:opacity-80 transition-opacity disabled:opacity-40"
              >
                <X size={13} />
                Decline
              </button>
            </>
          )}

          {activeTab === 'decided' && (app.status === 'accepted' || app.status === 'rejected') && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${DECIDED_CONFIG[app.status].classes}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${DECIDED_CONFIG[app.status].dot}`} />
              {DECIDED_CONFIG[app.status].label}
            </span>
          )}
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
}
