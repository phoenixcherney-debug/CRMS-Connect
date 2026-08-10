import { useCallback, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { AdminShell } from './AdminShell'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { friendlyError } from '../../lib/errors'
import { messageTime } from '../../lib/format'
import { AUDIT_LOG_LIMIT } from '../../lib/constants'
import type { AuditEntry, PublicProfile } from '../../types'

type Row = AuditEntry & { actor: Pick<PublicProfile, 'id' | 'full_name'> | null }

const ACTION_LABEL: Record<string, string> = {
  approve_account: 'approved an account',
  disable_account: 'disabled an account',
  reenable_account: 're-enabled an account',
  hide_offer: 'unlisted an offer',
  unhide_offer: 'restored an offer',
  resolved_report: 'resolved a report',
  dismissed_report: 'dismissed a report',
}

export function AdminAudit() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isActive: () => boolean) => {
    const { data, error: err } = await supabase
      .from('audit_log')
      .select('*, actor:profiles!audit_log_actor_id_fkey(id, full_name)')
      .order('created_at', { ascending: false })
      .limit(AUDIT_LOG_LIMIT)
    if (!isActive()) return
    // A failed query used to render as "Nothing yet" — the compliance page
    // reporting an empty staff record is worse than reporting an outage.
    if (err) { setError(friendlyError(err)); return }
    setError(null)
    setRows((data ?? []))
  }, [])

  usePageData(load)

  return (
    <AdminShell title="Audit log">
      <p className="-mt-2 mb-5 text-sm text-faint">
        Every staff action, recorded automatically. Last {AUDIT_LOG_LIMIT} entries.
      </p>
      {error ? (
        <EmptyState title="We couldn’t load the audit log">{error}</EmptyState>
      ) : rows === null ? (
        <Spinner page />
      ) : rows.length === 0 ? (
        <p className="text-sm text-faint">Nothing yet — staff actions will appear here.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-5 py-3">
              <span className="text-sm font-medium text-ink">{r.actor?.full_name ?? 'System'}</span>
              <span className="text-sm text-faint">{ACTION_LABEL[r.action] ?? r.action}</span>
              {r.target_kind && <span className="text-xs text-faint">({r.target_kind})</span>}
              <span className="ml-auto text-xs text-faint">{messageTime(r.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  )
}
