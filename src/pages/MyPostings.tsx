import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Edit3, Trash2, Users, Eye, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Application } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/ToastProvider'
import { format, isPast, parseISO } from 'date-fns'

interface PostingWithApplicants extends Job {
  applications: Application[]
}

export default function MyPostings() {
  const { profile } = useAuth()
  const toast = useToast()
  const [postings, setPostings] = useState<PostingWithApplicants[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // H-04 — Close (deactivate) needs a confirm so it doesn't fire from a
  // misclick. We don't gate Reopen — that's recoverable.
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null)

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

  async function toggleActive(jobId: string, currentActive: boolean) {
    const { error } = await supabase
      .from('jobs')
      .update({ is_active: !currentActive })
      .eq('id', jobId)
    if (!error) {
      setPostings((prev) =>
        prev.map((p) => (p.id === jobId ? { ...p, is_active: !currentActive } : p))
      )
      toast(currentActive ? 'Opportunity closed.' : 'Opportunity reopened.')
    } else {
      toast('Could not update the opportunity. Please try again.', { kind: 'error' })
    }
  }

  async function handleDelete(jobId: string) {
    setDeletingId(jobId)
    setDeleteError(null)
    const { error } = await supabase.from('jobs').delete().eq('id', jobId)
    setDeletingId(null)
    if (error) {
      setDeleteError('Failed to delete. Please try again.')
      toast('Could not delete the opportunity.', { kind: 'error' })
      return
    }
    setConfirmDeleteId(null)
    setPostings((prev) => prev.filter((p) => p.id !== jobId))
    toast('Opportunity deleted.')
  }

  const jobToDelete = postings.find((p) => p.id === confirmDeleteId)
  const jobToClose  = postings.find((p) => p.id === confirmCloseId)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>My Opportunities</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {loading ? 'Loading…' : `${postings.length} opportunit${postings.length !== 1 ? 'ies' : 'y'}`}
          </p>
        </div>
        <Link
          to="/opportunities/new"
          className="btn-gold shrink-0"
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
            to="/opportunities/new"
            className="btn-gold"
          >
            <Plus size={15} /> Post your first opportunity
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {postings.map((job) => {
            const deadline = job.deadline ? parseISO(job.deadline) : null
            const expired = deadline ? isPast(deadline) : false
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
                      to={`/opportunities/${job.id}`}
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
                      {deadline
                        ? <>Deadline: {format(deadline, 'MMM d, yyyy')}{expired && <span className="text-error ml-1">(passed)</span>}</>
                        : 'Rolling — no deadline'}
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
                            s === 'accepted' ? 'bg-status-accepted-dot'
                            : s === 'rejected' ? 'bg-status-rejected-dot'
                            : s === 'reviewed' ? 'bg-status-reviewed-dot'
                            : 'bg-status-pending-dot'
                          }`} />
                          <span className="text-xs text-ink-secondary capitalize">{s}: {count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {applicantCount > 0 && (
                    <Link
                      to={`/opportunities/${job.id}/applicants`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary-muted
                        text-sm text-primary hover:bg-primary-muted transition-colors"
                    >
                      <Eye size={14} /> View applicants
                    </Link>
                  )}
                  <button type="button"
                    onClick={() => {
                      // Reopen is non-destructive, fire directly.
                      if (!job.is_active) { void toggleActive(job.id, job.is_active); return }
                      setConfirmCloseId(job.id)
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors
                      ${job.is_active
                        ? 'border-status-pending-border text-status-pending-text hover:bg-status-pending-bg'
                        : 'border-status-accepted-border text-success hover:bg-success-bg'
                      }`}
                    title={job.is_active ? 'Stop accepting applications (you can reopen later)' : 'Reopen this opportunity to accept applications'}
                    aria-label={job.is_active ? 'Close opportunity (stop accepting applications)' : 'Reopen opportunity'}
                  >
                    {job.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {job.is_active ? 'Close' : 'Reopen'}
                  </button>
                  <Link
                    to={`/opportunities/${job.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border
                      text-sm text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                  >
                    <Edit3 size={14} /> Edit
                  </Link>
                  <button type="button"
                    onClick={() => { setConfirmDeleteId(job.id); setDeleteError(null) }}
                    aria-label="Delete opportunity (permanently remove)"
                    title="Permanently delete this opportunity"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-status-rejected-border
                      text-sm text-error hover:bg-error-bg transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation — uses the shared ConfirmDialog (audit task 6). */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this opportunity?"
        description={(() => {
          const count = jobToDelete?.applications?.length ?? 0
          const title = jobToDelete?.title ?? 'the posting'
          const company = jobToDelete?.company ? ` at ${jobToDelete.company}` : ''
          const apps = count === 0
            ? 'It has no applications.'
            : `It has ${count} application${count === 1 ? '' : 's'} that will be removed too.`
          return `This permanently removes ${title}${company}. ${apps}`
        })()}
        confirmLabel={deletingId === confirmDeleteId ? 'Deleting…' : 'Yes, delete'}
        confirmDisabled={deletingId === confirmDeleteId}
        destructive
        onConfirm={() => { if (confirmDeleteId) void handleDelete(confirmDeleteId) }}
        onCancel={() => { if (!deletingId) { setConfirmDeleteId(null); setDeleteError(null) } }}
      >
        {deleteError && <p className="mb-3 text-sm text-error">{deleteError}</p>}
      </ConfirmDialog>

      {/* Close (deactivate) confirmation — H-04. */}
      <ConfirmDialog
        open={confirmCloseId !== null}
        title="Close this opportunity?"
        description={`Applicants can no longer apply to ${jobToClose?.title ?? 'this opportunity'}; existing applications are preserved. You can reopen it later.`}
        confirmLabel="Yes, close it"
        onConfirm={() => {
          if (confirmCloseId) void toggleActive(confirmCloseId, true)
          setConfirmCloseId(null)
        }}
        onCancel={() => setConfirmCloseId(null)}
      />
    </div>
  )
}
