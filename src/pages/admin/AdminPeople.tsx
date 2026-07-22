import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { useAuth } from '../../contexts/AuthContext'
import { AdminShell } from './AdminShell'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PersonLink } from '../../components/PersonLink'
import { useToast } from '../../components/ui/Toast'
import { friendlyError } from '../../lib/errors'
import { shortDate } from '../../lib/format'
import type { AccountStatus, Profile, UserRole } from '../../types'

const STATUS_TINT: Record<AccountStatus, string> = {
  pending: 'bg-gold-soft text-clay-deep',
  active: 'bg-meadow text-pine',
  disabled: 'bg-clay-soft text-danger',
}

export function AdminPeople() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [people, setPeople] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (err) { setError(friendlyError(err)); return }
    setError(null)
    setPeople(data ?? [])
  }, [])

  usePageData(load)

  const visible = useMemo(() => {
    return (people ?? []).filter((p) =>
      (statusFilter === 'all' || p.account_status === statusFilter) &&
      (roleFilter === 'all' || p.role === roleFilter) &&
      (!search.trim() || p.full_name.toLowerCase().includes(search.trim().toLowerCase())),
    )
  }, [people, statusFilter, roleFilter, search])

  async function setStatus(p: Profile, status: AccountStatus) {
    setActing(p.id)
    const { error } = await supabase.from('profiles').update({ account_status: status }).eq('id', p.id)
    setActing(null)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(status === 'active' ? `${p.full_name} is in.` : `${p.full_name}'s account is ${status}.`)
    load()
  }

  return (
    <AdminShell title="People">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search names…"
          aria-label="Search names"
          className="w-56 rounded-lg border border-input bg-card px-3 py-1.5 text-sm placeholder:text-faint/70 focus:border-pine focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AccountStatus | 'all')}
          aria-label="Filter by status"
          className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm"
        >
          <option value="all">Any status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          aria-label="Filter by role"
          className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm"
        >
          <option value="all">Any role</option>
          <option value="student">Students</option>
          <option value="member">Members</option>
          <option value="admin">Staff</option>
        </select>
      </div>

      <div className="mt-5">
        {error ? (
          <EmptyState title="We couldn’t load people">{error}</EmptyState>
        ) : people === null ? (
          <Spinner page />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {visible.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <PersonLink person={p} size="sm" sub={[p.title, p.organization].filter(Boolean).join(', ') || null} />
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="hidden text-xs text-faint md:inline">joined {shortDate(p.created_at)}</span>
                  <Badge tint={STATUS_TINT[p.account_status]}>{p.account_status}</Badge>
                  {p.id !== me?.id && (
                    <>
                      {p.account_status === 'pending' && (
                        <Button size="sm" loading={acting === p.id} onClick={() => setStatus(p, 'active')}>Approve</Button>
                      )}
                      {p.account_status === 'active' && p.role !== 'admin' && (
                        <Button size="sm" variant="danger" loading={acting === p.id} onClick={() => setStatus(p, 'disabled')}>Disable</Button>
                      )}
                      {p.account_status === 'disabled' && (
                        <Button size="sm" variant="secondary" loading={acting === p.id} onClick={() => setStatus(p, 'active')}>Re-enable</Button>
                      )}
                    </>
                  )}
                </span>
              </li>
            ))}
            {visible.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-faint">Nobody matches those filters.</li>
            )}
          </ul>
        )}
      </div>
    </AdminShell>
  )
}
