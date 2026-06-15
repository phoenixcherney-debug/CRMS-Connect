import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ScrollText, ChevronLeft } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

interface AuditRow {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor: { id: string; full_name: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  ban_user: 'Banned user',
  unban_user: 'Unbanned user',
  delete_user: 'Deleted user',
  set_role: 'Changed role',
  hide_content: 'Hid content',
  unhide_content: 'Unhid content',
}

/**
 * A9 — read-only admin audit log. Every admin action (ban/unban/delete/role/
 * hide) is recorded by the admin RPCs; this surfaces them for traceability.
 * Admin-only (gated in App.tsx; rows are also RLS-protected to admins).
 */
export default function AdminAudit() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [actionFilter, setActionFilter] = useState<'all' | string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setLoadError(false)
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('id, action, target_type, target_id, metadata, created_at, actor:profiles!admin_audit_log_actor_id_fkey(id, full_name)')
        .order('created_at', { ascending: false })
        .limit(300)
      if (!mounted) return
      if (error) { setLoadError(true); setLoading(false); return }
      setRows((data as unknown as AuditRow[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [reloadKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false
      if (!q) return true
      return (
        (r.actor?.full_name ?? '').toLowerCase().includes(q) ||
        (r.target_id ?? '').toLowerCase().includes(q) ||
        (r.target_type ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, actionFilter, search])

  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  )

  return (
    <div className="max-w-3xl mx-auto">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-4 transition-colors">
        <ChevronLeft size={16} /> Admin Panel
      </Link>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2" style={{ fontFamily: 'var(--font-serif)' }}>
          <ScrollText size={20} /> Audit log
        </h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${filtered.length} of ${rows.length} recorded action${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-ink-secondary"
        >
          <option value="all">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by admin, target id, or type…"
          className="flex-1 min-w-[12rem] px-3 py-1.5 rounded-lg border border-border bg-surface text-ink placeholder:text-ink-placeholder"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : loadError ? (
        <EmptyState
          icon={ScrollText}
          title="Couldn't load the audit log."
          description="Something went wrong. Please try again."
          ctaLabel="Retry"
          ctaOnClick={() => setReloadKey((k) => k + 1)}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={rows.length === 0 ? 'No admin actions recorded yet.' : 'No actions match your filters.'}
          description={rows.length === 0 ? 'Bans, deletions, role changes, and content hides will appear here.' : undefined}
        />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {filtered.map((r) => {
            const meta = r.metadata && Object.keys(r.metadata).length > 0
              ? Object.entries(r.metadata).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')
              : null
            return (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3 bg-surface">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-semibold">{r.actor?.full_name ?? 'Unknown admin'}</span>
                    <span className="text-ink-muted"> · {ACTION_LABELS[r.action] ?? r.action}</span>
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5 break-all">
                    {r.target_type ? `${r.target_type} ` : ''}{r.target_id ?? ''}
                    {meta ? ` — ${meta}` : ''}
                  </p>
                </div>
                <span className="text-xs text-ink-muted shrink-0">
                  {format(parseISO(r.created_at), 'MMM d, h:mm a')}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
