import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronLeft, Ban, RotateCcw, Briefcase, FileText, BookOpen,
  AlertCircle, Trash2, User,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Profile, Application, Job, StudentPost } from '../types'
import { ROLE_LABELS, STATUS_LABELS, JOB_TYPE_LABELS, OPPORTUNITY_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

export default function AdminUserView() {
  const { id } = useParams<{ id: string }>()

  const [person, setPerson] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [studentPosts, setStudentPosts] = useState<StudentPost[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDeleteJob, setConfirmDeleteJob] = useState<string | null>(null)

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
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('*')
        .eq('posted_by', userId)
        .order('created_at', { ascending: false })
      setJobs((jobsData as Job[]) ?? [])
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!person) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-ink-muted">User not found.</p>
        <Link to="/admin" className="mt-4 inline-block text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
          ← Back to Admin Panel
        </Link>
      </div>
    )
  }

  const initials = person.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const isStudent = person.role === 'student'
  const isEM = person.role === 'employer_mentor'

  function statusBadgeStyle(status: string) {
    const map: Record<string, { bg: string; color: string }> = {
      accepted:   { bg: 'var(--color-success-bg)',  color: 'var(--color-success)' },
      rejected:   { bg: 'var(--color-error-bg)',    color: 'var(--color-error)' },
      pending:    { bg: 'var(--color-surface-raised)', color: 'var(--color-ink-secondary)' },
      reviewed:   { bg: 'var(--color-primary-muted)', color: 'var(--color-primary)' },
      waitlisted: { bg: 'var(--color-accent-muted)', color: 'var(--color-accent-dark)' },
    }
    return map[status] ?? map.pending
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Back */}
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Back to Admin Panel
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

      {/* Profile card */}
      <div
        className="rounded-2xl border border-border p-6 mb-6"
        style={{ backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden"
              style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
            >
              {person.avatar_url ? (
                <img src={person.avatar_url} alt={person.full_name} className="w-full h-full object-cover" />
              ) : initials}
            </div>
            <div>
              <h1 className="text-lg font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
                {person.full_name}
              </h1>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}
                >
                  {ROLE_LABELS[person.role] ?? person.role}
                </span>
                {person.banned_at && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}
                  >
                    Banned
                  </span>
                )}
              </div>
              {email && <p className="text-xs text-ink-muted mt-1">{email}</p>}
            </div>
          </div>

          {/* Ban/Unban */}
          {person.banned_at ? (
            <button
              onClick={handleUnban}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-surface-raised shrink-0"
              style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
            >
              <RotateCcw size={14} />
              Unban
            </button>
          ) : (
            <button
              onClick={handleBan}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-error-bg shrink-0"
              style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            >
              <Ban size={14} />
              Ban
            </button>
          )}
        </div>

        {/* Profile details */}
        {(person.bio || person.company || person.grade || person.industry) && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {person.bio && <p className="text-sm text-ink-secondary leading-relaxed">{person.bio}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {person.company && <span>Company: <span className="text-ink-secondary font-medium">{person.company}</span></span>}
              {person.grade && <span>Grade: <span className="text-ink-secondary font-medium">{person.grade}</span></span>}
              {person.industry && <span>Industry: <span className="text-ink-secondary font-medium">{person.industry}</span></span>}
              <span>Joined: <span className="text-ink-secondary font-medium">
                {new Date(person.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span></span>
            </div>
          </div>
        )}
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
                              <span className="ml-1">· {JOB_TYPE_LABELS[(app.jobs as any).job_type] ?? (app.jobs as any).job_type}</span>
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
