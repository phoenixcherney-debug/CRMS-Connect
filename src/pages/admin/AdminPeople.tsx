import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { setAccountStatus } from '../../lib/mutations'
import { PAGE_SIZE } from '../../lib/constants'
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

const CONTROL = 'rounded-lg border border-input bg-card px-2.5 py-1.5 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20'

export function AdminPeople() {
  const { profile: me } = useAuth()
  const toast = useToast()
  const [people, setPeople] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<AccountStatus | 'all'>('all')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [acting, setActing] = useState<string | null>(null)

  // Debounce the search box into the applied filter (and reset pagination).
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setLimit(PAGE_SIZE)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async (isActive: () => boolean) => {
    let q = supabase.from('profiles').select('*')
    if (statusFilter !== 'all') q = q.eq('account_status', statusFilter)
    if (roleFilter !== 'all') q = q.eq('role', roleFilter)
    if (search) q = q.ilike('full_name', `%${search}%`)
    const { data, error: err } = await q.order('created_at', { ascending: false }).range(0, limit - 1)
    if (!isActive()) return
    if (err) { setError(friendlyError(err)); return }
    setError(null)
    setPeople(data ?? [])
  }, [statusFilter, roleFilter, search, limit])

  usePageData(load)

  const hasMore = (people?.length ?? 0) === limit

  async function setStatus(p: Profile, status: AccountStatus) {
    setActing(p.id)
    const { error } = await setAccountStatus(p.id, status)
    setActing(null)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(status === 'active' ? `${p.full_name} is in.` : `${p.full_name}'s account is ${status}.`)
    load(() => true)
  }

  return (
    <AdminShell title="People">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search names…"
          aria-label="Search names"
          className={`w-56 ${CONTROL}`}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as AccountStatus | 'all'); setLimit(PAGE_SIZE) }}
          aria-label="Filter by status"
          className={CONTROL}
        >
          <option value="all">Any status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as UserRole | 'all'); setLimit(PAGE_SIZE) }}
          aria-label="Filter by role"
          className={CONTROL}
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
          <>
            <ul className="divide-y divide-line rounded-xl border border-line bg-card">
              {people.map((p) => (
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
              {people.length === 0 && (
                <li className="px-5 py-8 text-center text-sm text-faint">Nobody matches those filters.</li>
              )}
            </ul>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE_SIZE)}>Load more</Button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  )
}
