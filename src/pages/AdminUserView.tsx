import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, Ban, RotateCcw, Briefcase, FileText, BookOpen,
  AlertCircle, Trash2, User, MessageSquare, Heart, Shield,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, Application, Job, StudentPost, CareerHistory } from '../types'
import {
  ROLE_LABELS, STATUS_LABELS, JOB_TYPE_LABELS, OPPORTUNITY_TYPE_LABELS,
  MENTOR_TYPE_LABELS, STUDENT_SEEKING_LABELS,
} from '../types'
import Spinner from '../components/Spinner'

export default function AdminUserView() {
  const { id } = useParams<{ id: string }>()
  const { profile: adminProfile } = useAuth()
  const navigate = useNavigate()

  const [person, setPerson] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [studentPosts, setStudentPosts] = useState<StudentPost[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [careerHistory, setCareerHistory] = useState<CareerHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<string | null>(null)
  const [messagingLoading, setMessagingLoading] = useState(false)

  useEffect(() => {
    if (id) load(id)
  }, [id])

  async function load(userId: string) {
    setLoading(true)

    const [profileRes, emailRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.rpc('admin_get_user_email', { target_id: userId }),
    ])

    const profile = profileRes.data as Profile | null
    setPerson(profile)
    setEmail(emailRes.data as string | null)

    if (profile?.role === 'student') {
      const [appsRes, postsRes] = await Promise.all([
        supabase
          .from('applications')
          .select('*, jobs(id, title, company, job_type, deadline, opportunity_type)')
          .eq('applicant_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('student_posts')
          .select('*')
          .eq('student_id', userId)
          .order('created_at', { ascending: false }),
      ])
      setApplications((appsRes.data as Application[]) ?? [])
      setStudentPosts((postsRes.data as StudentPost[]) ?? [])
    } else if (profile?.role === 'employer_mentor') {
      const [jobsRes, careerRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('posted_by', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('career_history')
          .select('*')
          .eq('profile_id', userId)
          .order('is_current', { ascending: false })
          .order('start_year', { ascending: false }),
      ])
      setJobs((jobsRes.data as Job[]) ?? [])
      setCareerHistory((careerRes.data as CareerHistory[]) ?? [])
    }

    setLoading(false)
  }

  async function handleBan() {
    if (!id) return
    setActionError(null)
    const { error } = await supabase.rpc('admin_ban_user', { target_id: id })
    if (error) { setActionError(error.message); return }
    setPerson(prev => prev ? { ...prev, banned_at: new Date().toISOString() } : prev)
  }

  async function handleUnban() {
    if (!id) return
    setActionError(null)
    const { error } = await supabase.rpc('admin_unban_user', { target_id: id })
    if (error) { setActionError(error.message); return }
    setPerson(prev => prev ? { ...prev, banned_at: null } : prev)
  }

  async function handleDeleteJob(jobId: string) {
    setActionError(null)
    const { error } = await supabase.from('jobs').delete().eq('id', jobId)
    if (error) { setActionError(error.message); return }
    setJobs(prev => prev.filter(j => j.id !== jobId))
    setConfirmDeleteJob(null)
  }

  async function openConversation() {
    if (!adminProfile || !person) return
    setMessagingLoading(true)
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${adminProfile.id},participant_two.eq.${person.id}),` +
        `and(participant_one.eq.${person.id},participant_two.eq.${adminProfile.id})`
      )
      .maybeSingle()

    if (existing) {
      navigate(`/messages/${existing.id}`)
      return
    }

    const [p1, p2] = [adminProfile.id, person.id].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()
    setMessagingLoading(false)
    if (data) navigate(`/messages/${data.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <p className="text-ink-muted">User not found.</p>
        <Link to="/admin" className="mt-4 inline-block text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Back to Admin Panel
        </Link>
      </div>
    )
  }

  const initials = person.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const isStudent = person.role === 'student'
  const isEM = person.role === 'employer_mentor'

  const mentorTypeLabel = person.mentor_type === 'other'
    ? (person.mentor_type_other || 'Other')
    : person.mentor_type ? MENTOR_TYPE_LABELS[person.mentor_type] : null
  const studentSeekingLabel = person.student_seeking === 'other'
    ? (person.student_seeking_other || 'Other')
    : person.student_seeking ? STUDENT_SEEKING_LABELS[person.student_seeking] : null

  function statusBadgeStyle(status: string) {
    const map: Record<string, { bg: string; color: string }> = {
      accepted:   { bg: 'var(--color-success-bg)',    color: 'var(--color-success)' },
      rejected:   { bg: 'var(--color-error-bg)',      color: 'var(--color-error)' },
      pending:    { bg: 'var(--color-surface-raised)', color: 'var(--color-ink-secondary)' },
      reviewed:   { bg: 'var(--color-primary-muted)', color: 'var(--color-primary)' },
      waitlisted: { bg: 'var(--color-accent-muted)',  color: 'var(--color-accent-dark)' },
    }
    return map[status] ?? map.pending
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Back */}
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Admin Panel
      </Link>

      {actionError && (
        <div
          className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--color-error-bg)', borderColor: 'var(--color-error-border)', color: 'var(--color-error)' }}
        >
          <AlertCircle size={15} className="shrink-0" />
          {actionError}
        </div>
      )}

      {/* Admin action bar */}
      <div
        className="flex items-center gap-2 p-3 rounded-xl border border-border mb-4"
        style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted mr-auto">
          <Shield size={13} style={{ color: 'var(--color-primary)' }} />
          Admin View
          {person.banned_at && (
            <span
              className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}
            >
              Banned
            </span>
          )}
        </div>
        <button
          onClick={openConversation}
          disabled={messagingLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-ink-secondary hover:bg-surface-raised transition-colors"
        >
          {messagingLoading ? <Spinner size="sm" /> : <MessageSquare size={13} />}
          Message
        </button>
        {person.banned_at ? (
          <button
            onClick={handleUnban}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors hover:bg-surface-raised"
            style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
          >
            <RotateCcw size={13} />
            Unban
          </button>
        ) : (
          <button
            onClick={handleBan}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
            style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
          >
            <Ban size={13} />
            Ban
          </button>
        )}
      </div>

      {/* Profile card (mirrors PublicProfile) */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden mb-6" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Banner */}
        <div
          className="h-32 relative overflow-hidden"
          style={{
            background: `
              radial-gradient(ellipse 70% 120% at 80% 10%, rgba(74,124,47,0.7) 0%, transparent 60%),
              radial-gradient(ellipse 50% 100% at 10% 90%, rgba(45,80,22,0.5) 0%, transparent 50%),
              linear-gradient(155deg, #2D5016 0%, #3A6B1E 40%, #4A7C2F 70%, #3A6B1E 100%)
            `,
          }}
        >
          <div className="absolute top-[-30%] right-[8%] w-24 h-24 rounded-full opacity-[0.12] border border-white/20"
            style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
          <div className="absolute top-[-10%] right-[30%] w-14 h-14 rounded-full opacity-[0.09] border border-white/10"
            style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-20%] left-[15%] w-20 h-20 rounded-full opacity-[0.08] border border-white/10"
            style={{ background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />
        </div>

        <div className="px-6 pb-6 relative">
          {/* Avatar + name */}
          <div className="-mt-8 mb-5 flex items-end gap-4">
            <div className="w-16 h-16 rounded-2xl border-4 border-surface bg-primary-muted flex items-center justify-center overflow-hidden shrink-0">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.full_name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="text-primary font-bold text-xl">{initials}</span>
              )}
            </div>
            <div className="pb-1 flex-1">
              <p className="font-semibold text-ink text-lg">{person.full_name}</p>
              {email && <p className="text-xs text-ink-muted mb-1">{email}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">
                  <User size={11} />
                  {ROLE_LABELS[person.role] ?? person.role}
                </span>
                {person.grade && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-border text-ink-secondary text-xs font-medium">
                    {person.grade}
                  </span>
                )}
                {isEM && person.open_to_mentorship && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success-bg text-success text-xs font-medium">
                    <Heart size={11} />
                    Open to mentorship
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Info card */}
            <div className="p-3 rounded-lg bg-primary-faint border border-border text-sm space-y-1.5">
              <div className="flex gap-2">
                <span className="font-medium text-ink w-28 shrink-0">Member since</span>
                <span className="text-ink-secondary">
                  {new Date(person.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              {person.graduation_year && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">
                    {person.role === 'student' ? 'Graduating' : 'Graduated'}
                  </span>
                  <span className="text-ink-secondary">{person.graduation_year}</span>
                </div>
              )}
              {isStudent && studentSeekingLabel && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Looking for</span>
                  <span className="text-ink-secondary">{studentSeekingLabel}</span>
                </div>
              )}
              {isEM && person.company && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Company</span>
                  <span className="text-ink-secondary">{person.company}</span>
                </div>
              )}
              {isEM && person.industry && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Industry</span>
                  <span className="text-ink-secondary">{person.industry}</span>
                </div>
              )}
              {isEM && mentorTypeLabel && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Type</span>
                  <span className="text-ink-secondary">{mentorTypeLabel}</span>
                </div>
              )}
              {person.weekly_availability && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Availability</span>
                  <span className="text-ink-secondary">{person.weekly_availability}</span>
                </div>
              )}
            </div>

            {/* Interests (students) */}
            {person.interests && person.interests.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {person.interests.map((interest) => (
                    <span key={interest} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary-muted text-primary">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {person.bio ? (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Bio</p>
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{person.bio}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted italic">This user hasn't added a bio yet.</p>
            )}

            {/* Career History (employer/mentor only) */}
            {isEM && (
              <div>
                <p className="text-sm font-medium text-ink mb-2 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-ink-muted" />
                  Career History
                </p>
                {careerHistory.length > 0 ? (
                  <div className="space-y-2">
                    {careerHistory.map((entry) => (
                      <div key={entry.id} className="p-3 rounded-lg bg-primary-faint border border-border text-sm">
                        <p className="font-medium text-ink">{entry.title}</p>
                        <p className="text-ink-secondary">{entry.company} · {entry.start_year}–{entry.is_current ? 'Present' : entry.end_year ?? ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted italic">No career history added yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Student sections ─────────────────────────────────────────────────── */}
      {isStudent && (
        <>
          {/* Applications */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText size={14} />
              Applications ({applications.length})
            </h2>
            {applications.length === 0 ? (
              <p className="text-sm text-ink-muted">No applications yet.</p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {applications.map(app => {
                    const s = statusBadgeStyle(app.status)
                    return (
                      <div key={app.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-surface hover:bg-surface-hover transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">
                            {(app.jobs as any)?.title ?? 'Unknown job'}
                          </p>
                          <p className="text-xs text-ink-muted">
                            {(app.jobs as any)?.company ?? ''}
                            {(app.jobs as any)?.job_type && (
                              <span className="ml-1">· {JOB_TYPE_LABELS[(app.jobs as any).job_type as keyof typeof JOB_TYPE_LABELS] ?? (app.jobs as any).job_type}</span>
                            )}
                          </p>
                        </div>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.bg, color: s.color }}
                        >
                          {STATUS_LABELS[app.status]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Student Posts */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen size={14} />
              Posts ({studentPosts.length})
            </h2>
            {studentPosts.length === 0 ? (
              <p className="text-sm text-ink-muted">No posts yet.</p>
            ) : (
              <div className="space-y-3">
                {studentPosts.map(post => (
                  <div
                    key={post.id}
                    className="rounded-xl border border-border p-4"
                    style={{ backgroundColor: 'var(--color-surface)' }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={
                          post.is_closed
                            ? { backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-ink-muted)' }
                            : { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }
                        }
                      >
                        {post.is_closed ? 'Closed' : 'Open'}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-sm text-ink leading-relaxed line-clamp-3">{post.pitch}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ── Employer/Mentor sections ─────────────────────────────────────────── */}
      {isEM && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <Briefcase size={14} />
            Job Postings ({jobs.length})
          </h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-ink-muted">No postings yet.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {jobs.map(job => (
                  <div key={job.id} className="flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-hover transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{job.title}</p>
                      <p className="text-xs text-ink-muted">
                        {job.company}
                        {job.opportunity_type && (
                          <span className="ml-1">· {OPPORTUNITY_TYPE_LABELS[job.opportunity_type] ?? job.opportunity_type}</span>
                        )}
                      </p>
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={
                        job.is_active
                          ? { backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }
                          : { backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-ink-muted)' }
                      }
                    >
                      {job.is_active ? 'Active' : 'Closed'}
                    </span>
                    {/* Delete */}
                    <div className="shrink-0">
                      {confirmDeleteJob === job.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-ink-muted hidden sm:inline">Delete?</span>
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ backgroundColor: 'var(--color-error)', color: '#ffffff' }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmDeleteJob(null)}
                            className="px-2 py-1 rounded text-xs font-semibold text-ink-secondary hover:bg-surface-raised"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteJob(job.id)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-error-bg"
                          style={{ color: 'var(--color-error)' }}
                          title="Delete posting"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Admin role — no content sections */}
      {!isStudent && !isEM && (
        <div
          className="rounded-xl border border-border p-6 text-center"
          style={{ backgroundColor: 'var(--color-surface)' }}
        >
          <User size={24} className="mx-auto mb-2 text-ink-muted" />
          <p className="text-sm text-ink-muted">Admin accounts have no associated content.</p>
        </div>
      )}
    </div>
  )
}
