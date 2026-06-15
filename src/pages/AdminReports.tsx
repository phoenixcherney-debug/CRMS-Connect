import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, ExternalLink, Eye } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ToastProvider'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'

interface UserReport {
  id: string
  reporter_id: string
  reported_id: string
  reason: string
  status: 'open' | 'reviewed' | 'actioned'
  created_at: string
  reporter: { id: string; full_name: string } | null
  reported: { id: string; full_name: string; banned_at: string | null } | null
}

/**
 * SEC-003 — staff triage queue for reports filed via <ReportUserButton/>.
 * Admin-only (gated upstream in App.tsx).
 *
 * Mark Reviewed → no action taken; the row stays as a paper trail.
 * Mark Actioned → flips the reported account to status='disabled'. The
 *   existing rendering layer surfaces "Deleted user" everywhere a banned
 *   profile would otherwise show.
 */
export default function AdminReports() {
  const toast = useToast()
  const [reports, setReports] = useState<UserReport[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)
  const [confirmDisable, setConfirmDisable] = useState<{ id: string; reportedId: string; name: string } | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('user_reports')
      .select(`
        id, reporter_id, reported_id, reason, status, created_at,
        reporter:profiles!user_reports_reporter_id_fkey(id, full_name),
        reported:profiles!user_reports_reported_id_fkey(id, full_name, banned_at)
      `)
      .order('created_at', { ascending: false })
    setReports((data as unknown as UserReport[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function markReviewed(id: string) {
    setActingId(id)
    const { error } = await supabase
      .from('user_reports')
      .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
      .eq('id', id)
    setActingId(null)
    if (error) { toast('Could not update.', { kind: 'error' }); return }
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'reviewed' } : r))
    toast('Marked reviewed.')
  }

  async function actionAccount(id: string, reportedId: string, name: string) {
    setActingId(id)
    // Block the reported account via the canonical ban path (sets banned_at and
    // writes an audit-log entry).
    const { error: e1 } = await supabase.rpc('admin_ban_user', { target_id: reportedId })
    if (e1) { setActingId(null); toast(`Could not block ${name}.`, { kind: 'error' }); return }
    const nowIso = new Date().toISOString()
    const { error: e2 } = await supabase
      .from('user_reports')
      .update({ status: 'actioned', reviewed_at: nowIso })
      .eq('id', id)
    setActingId(null)
    setConfirmDisable(null)
    if (e2) { toast('Account blocked but report not flipped.', { kind: 'error' }); return }
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'actioned', reported: r.reported ? { ...r.reported, banned_at: nowIso } : r.reported } : r))
    toast(`Blocked ${name} and closed the report.`)
  }

  const open      = reports.filter((r) => r.status === 'open')
  const reviewed  = reports.filter((r) => r.status === 'reviewed')
  const actioned  = reports.filter((r) => r.status === 'actioned')

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
          User reports
        </h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${open.length} open · ${reviewed.length} reviewed · ${actioned.length} actioned`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No reports."
          description="When users flag a profile, it'll show up here for triage."
        />
      ) : (
        <div className="space-y-6">
          {[
            { label: 'Open', items: open, badge: 'bg-status-pending-bg text-status-pending-text' },
            { label: 'Reviewed', items: reviewed, badge: 'bg-border text-ink-secondary' },
            { label: 'Actioned', items: actioned, badge: 'bg-status-rejected-bg text-status-rejected-text' },
          ].map(({ label, items, badge }) => (
            items.length > 0 && (
              <section key={label}>
                <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3">{label}</h2>
                <div className="space-y-3">
                  {items.map((r) => {
                    const acting = actingId === r.id
                    return (
                      <div
                        key={r.id}
                        className="bg-surface rounded-xl border border-border p-5"
                        style={{ boxShadow: 'var(--shadow-card)' }}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              {r.reporter?.id ? (
                                <Link to={`/admin/users/${r.reporter.id}`} className="font-semibold text-ink hover:text-primary">
                                  {r.reporter.full_name}
                                </Link>
                              ) : (
                                <span className="font-semibold text-ink-muted">{r.reporter?.full_name ?? 'Unknown (deleted)'}</span>
                              )}
                              <span className="text-ink-muted">{' reported '}</span>
                              {r.reported?.id ? (
                                <Link to={`/admin/users/${r.reported.id}`} className="font-semibold text-ink hover:text-primary">
                                  {r.reported.full_name}
                                </Link>
                              ) : (
                                <span className="font-semibold text-ink-muted">{r.reported?.full_name ?? 'Unknown (deleted)'}</span>
                              )}
                              {r.reported?.banned_at && (
                                <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium ${badge}`}>
                                  account blocked
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-ink-muted mt-0.5">
                              {format(parseISO(r.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-ink-secondary leading-relaxed mb-3">"{r.reason}"</p>
                        {r.status === 'open' && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => markReviewed(r.id)}
                              disabled={acting}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-ink-secondary hover:bg-primary-faint disabled:opacity-40 transition-colors"
                            >
                              <Eye size={13} /> Mark reviewed
                            </button>
                            {r.reported?.id && !r.reported.banned_at && (
                              <button
                                type="button"
                                onClick={() => setConfirmDisable({ id: r.id, reportedId: r.reported!.id, name: r.reported!.full_name })}
                                disabled={acting}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-rejected-bg text-status-rejected-text border border-status-rejected-border hover:opacity-80 disabled:opacity-40 transition-opacity"
                              >
                                <AlertTriangle size={13} /> Block account
                              </button>
                            )}
                            {r.reported?.id && (
                              <Link
                                to={`/admin/users/${r.reported.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-ink-secondary hover:bg-primary-faint transition-colors"
                              >
                                <ExternalLink size={13} /> Open in admin
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDisable !== null}
        title={`Block ${confirmDisable?.name ?? 'this account'}?`}
        description={'The user is signed out and blocked from the app. You can unban them later from the admin panel.'}
        confirmLabel={actingId && confirmDisable && actingId === confirmDisable.id ? 'Blocking…' : 'Block account'}
        confirmDisabled={actingId !== null}
        destructive
        onConfirm={() => { if (confirmDisable) actionAccount(confirmDisable.id, confirmDisable.reportedId, confirmDisable.name) }}
        onCancel={() => { if (actingId === null) setConfirmDisable(null) }}
      />
    </div>
  )
}
