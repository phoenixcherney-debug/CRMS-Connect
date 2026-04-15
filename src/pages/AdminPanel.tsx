import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Shield, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'
import { ROLE_LABELS } from '../types'
import type { Role } from '../types'

type AdminUser = {
  id: string
  full_name: string
  role: string
  created_at: string
  banned_at: string | null
  onboarding_complete: boolean
  email: string
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) { setError(error.message) }
    else if (data) setUsers(data as AdminUser[])
    setLoading(false)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  function roleLabel(role: string) {
    return ROLE_LABELS[role as Role] ?? role
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--color-primary-muted)' }}
        >
          <Shield size={17} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
            Admin Panel
          </h1>
          <p className="text-xs text-ink-muted">{users.length} account{users.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && (
        <div
          className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--color-error-bg)', borderColor: 'var(--color-error-border)', color: 'var(--color-error)' }}
        >
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, email, or role…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
            placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            transition-colors"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-ink-muted py-12">No accounts found.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map(user => (
              <button
                key={user.id}
                onClick={() => navigate(`/admin/users/${user.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                {/* Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
                >
                  {initials(user.full_name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink">{user.full_name}</span>
                    {user.banned_at && (
                      <span
                        className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}
                      >
                        Banned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-muted truncate">{user.email}</p>
                </div>

                {/* Role */}
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 hidden sm:inline"
                  style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-ink-secondary)' }}
                >
                  {roleLabel(user.role)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
