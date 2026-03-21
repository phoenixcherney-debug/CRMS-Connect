import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit3, Trash2, Users, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Application } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'
import { format, isPast, parseISO } from 'date-fns'

interface PostingWithApplicants extends Job {
  applications: Application[]
}

export default function MyPostings() {
  const { profile } = useAuth()
  const [postings, setPostings] = useState<PostingWithApplicants[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    if (!profile) return
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('*, applications(id, status, applicant_id)')
      .eq('posted_by', profile.id)
      .order('created_at', { ascending: false })
    setPostings((data as PostingWithApplicants[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  async function handleDelete(jobId: string) {
    setDeletingId(jobId)
    const { error } = await supabase.from('jobs').delete().eq('id', jobId)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (!error) {
      setPostings((prev) => prev.filter((p) => p.id !== jobId))
    }
  }

  const jobToDelete = postings.find((p) => p.id === confirmDeleteId)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Postings</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {loading ? 'Loading…' : `${postings.length} listing${postings.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          to="/jobs/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
            bg-primary hover:bg-primary-light text-white font-medium text-sm
            transition-colors shrink-0"
        >
          <Plus size={16} /> Post an opportunity
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : postings.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted mb-3">You haven't posted any opportunities yet.</p>
          <Link
            to="/jobs/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
              bg-primary hover:bg-primary-light text-white font-medium text-sm transition-colors"
          >
            <Plus size={15} /> Post your first listing
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {postings.map((job) => {
            const deadline = parseISO(job.deadline)
            const expired = isPast(deadline)
            const applicantCount = job.applications?.length ?? 0

            return (
              <div
                key={job.id}
                className="bg-surface rounded-xl border border-border p-4 sm:p-5 flex flex-col sm:flex-row gap-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="font-semibold text-ink hover:text-primary transition-colors truncate"
                    >
                      {job.title}
                    </Link>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border
                      ${expired || !job.is_active
                        ? 'bg-border/40 text-ink-muted border-border'
                        : 'bg-primary-muted text-primary border-primary-muted'
                      }`}>
                      {expired || !job.is_active ? 'Closed' : JOB_TYPE_LABELS[job.job_type]}
                    </span>
                  </div>
                  <p className="text-sm text-ink-secondary">{job.company} · {job.location}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span>
                      Deadline: {format(deadline, 'MMM d, yyyy')}
                      {expired && <span className="text-error ml-1">(passed)</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {applicantCount} {applicantCount === 1 ? 'applicant' : 'applicants'}
                    </span>
                  </div>
                </div>

                {/* Applicant status breakdown */}
                {applicantCount > 0 && (
                  <div className="sm:border-l sm:border-border sm:pl-5 flex sm:flex-col gap-2 flex-wrap">
                    {(['pending', 'reviewed', 'accepted', 'rejected'] as const).map((s) => {
                      const count = (job.applications ?? []).filter((a) => a.status === s).length
                      if (count === 0) return null
                      return (
                        <div key={s} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            s === 'accepted' ? 'bg-success'
                            : s === 'rejected' ? 'bg-error'
                            : s === 'reviewed' ? 'bg-warning'
                            : 'bg-ink-muted'
                          }`} />
                          <span className="text-xs text-ink-secondary capitalize">{s}: {count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {applicantCount > 0 && (
                    <Link
                      to={`/jobs/${job.id}/applicants`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary-muted
                        text-sm text-primary hover:bg-primary-muted transition-colors"
                    >
                      <Eye size={14} /> Applicants
                    </Link>
                  )}
                  <Link
                    to={`/jobs/${job.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                      text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                  >
                    <Edit3 size={14} /> Edit
                  </Link>
                  <button
                    onClick={() => setConfirmDeleteId(job.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200
                      text-sm text-error hover:bg-error-bg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full"
            style={{ boxShadow: 'var(--shadow-modal)' }}
          >
            <h3 className="font-semibold text-ink mb-2">Delete this posting?</h3>
            <p className="text-sm text-ink-secondary mb-1 leading-relaxed">
              <span className="font-medium text-ink">{jobToDelete?.title}</span> at {jobToDelete?.company}
            </p>
            <p className="text-sm text-ink-secondary mb-5 leading-relaxed">
              This action is permanent. The listing and all applications will be removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deletingId === confirmDeleteId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  bg-error hover:bg-red-700 text-white font-medium text-sm
                  disabled:opacity-50 transition-colors"
              >
                {deletingId === confirmDeleteId
                  ? <Spinner size="sm" className="border-white/30 border-t-white" />
                  : null
                }
                {deletingId === confirmDeleteId ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={!!deletingId}
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
