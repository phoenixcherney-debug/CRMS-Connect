import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminShell } from './AdminShell'
import { Spinner } from '../../components/ui/Spinner'
import { messageTime } from '../../lib/format'
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

  useEffect(() => {
    let cancelled = false
    supabase
      .from('audit_log')
      .select('*, actor:profiles!audit_log_actor_id_fkey(id, full_name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as unknown as Row[])
      })
    return () => { cancelled = true }
  }, [])

  return (
    <AdminShell title="Audit log">
      <p className="-mt-2 mb-5 text-sm text-faint">
        Every staff action, recorded automatically. Last 100 entries.
      </p>
      {rows === null ? (
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
