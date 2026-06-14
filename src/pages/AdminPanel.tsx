import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Shield, AlertCircle, Trash2, ShieldCheck, ShieldOff, MessageSquare } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/ToastProvider'
import ConfirmDialog from '../components/ConfirmDialog'
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
  const { profile: me } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Delete-confirmation state. typedConfirm must match the target's
  // email before the destructive button enables.
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null)
  const [typedConfirm, setTypedConfirm]   = useState('')
  const [deleting, setDeleting]           = useState(false)
  // Role-change confirmation
  const [pendingRole, setPendingRole] = useState<{ user: AdminUser; newRole: 'student' | 'employer_mentor' | 'admin' } | null>(null)
  const [savingRole, setSavingRole]   = useState(false)
  // Filters
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'employer_mentor' | 'admin'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'banned' | 'active'>('all')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) { setError(friendlyError(error, 'Could not load the user list.')) }
    else if (data) setUsers(data as AdminUser[])
    setLoading(false)
  }

  async function setRole(user: AdminUser, newRole: 'student' | 'employer_mentor' | 'admin') {
    setSavingRole(true)
    const { error: err } = await supabase.rpc('admin_set_user_role', { target_id: user.id, new_role: newRole })
    setSavingRole(false)
    if (err) {
      toast(friendlyError(err, 'Could not change role.'), { kind: 'error' })
      return
    }
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u))
    toast(`${user.full_name || user.email} is now ${newRole}.`)
    setPendingRole(null)
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return
    setDeleting(true)
    const { error: delErr } = await supabase.rpc('admin_delete_user', { target_id: pendingDelete.id })
    setDeleting(false)
    if (delErr) {
      toast(friendlyError(delErr, 'Could not delete that account.'), { kind: 'error' })
      return
    }
    setUsers((prev) => prev.filter((u) => u.id !== pendingDelete.id))
    toast(`${pendingDelete.full_name || pendingDelete.email} deleted.`)
    setPendingDelete(null)
    setTypedConfirm('')
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchesSearch =
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    const matchesRole   = roleFilter === 'all'   || u.role === roleFilter
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'banned' && !!u.banned_at)
      || (statusFilter === 'active' && !u.banned_at)
    return matchesSearch && matchesRole && matchesStatus
  })

  function initials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  function roleLabel(role: string) {
    return ROLE_LABELS[role as Role] ?? role
  }

  const expectedEmail = (pendingDelete?.email ?? '').trim().toLowerCase()
  const confirmMatches = typedConfirm.trim().toLowerCase() === expectedEmail && expectedEmail.length > 0

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
      <div className="relative mb-3">
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

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-muted font-medium mr-1">Role:</span>
        {([
          { v: 'all',             l: 'All' },
          { v: 'student',         l: 'Students' },
          { v: 'employer_mentor', l: 'Employer/Mentor' },
          { v: 'admin',           l: 'Admin' },
        ] as const).map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setRoleFilter(opt.v)}
            className={`px-2.5 py-1 rounded-md border transition-colors ${roleFilter === opt.v ? 'border-primary bg-primary-muted text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
          >
            {opt.l}
          </button>
        ))}
        <span className="text-ink-muted font-medium ml-3 mr-1">Status:</span>
        {([
          { v: 'all',    l: 'All' },
          { v: 'active', l: 'Active' },
          { v: 'banned', l: 'Banned' },
        ] as const).map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setStatusFilter(opt.v)}
            className={`px-2.5 py-1 rounded-md border transition-colors ${statusFilter === opt.v ? 'border-primary bg-primary-muted text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
          >
            {opt.l}
          </button>
        ))}
        <Link
          to="/admin/messages"
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-ink-secondary hover:bg-primary-faint"
        >
          <MessageSquare size={11} /> Conversations
        </Link>
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
            {filtered.map(user => {
              const isSelf = user.id === me?.id
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/users/${user.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
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
                        {isSelf && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-primary-muted text-primary">
                            You
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

                  {/* Promote / demote */}
                  {user.role !== 'admin' ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingRole({ user, newRole: 'admin' }) }}
                      className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-ink-secondary hover:bg-primary-faint transition-colors"
                      aria-label={`Promote ${user.full_name} to admin`}
                      title="Promote to admin"
                    >
                      <ShieldCheck size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingRole({ user, newRole: 'student' }) }}
                      disabled={isSelf}
                      className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-ink-secondary hover:bg-primary-faint transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={`Demote ${user.full_name}`}
                      title={isSelf ? 'You can\'t demote yourself' : 'Demote to student'}
                    >
                      <ShieldOff size={14} />
                    </button>
                  )}

                  {/* Delete — disabled for the admin acting on themselves */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(user); setTypedConfirm('') }}
                    disabled={isSelf}
                    className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg border border-status-rejected-border text-error hover:bg-error-bg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label={`Delete ${user.full_name}`}
                    title={isSelf ? 'You can\'t delete yourself' : 'Delete account'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.full_name ?? 'this account'}?`}
        description={'This permanently removes the auth row and cascades to their profile, applications, posts, messages, and uploads. This cannot be undone.'}
        confirmLabel={deleting ? 'Deleting…' : 'Permanently delete'}
        confirmDisabled={!confirmMatches || deleting}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) { setPendingDelete(null); setTypedConfirm('') } }}
      >
        <label className="block text-xs font-medium text-ink mb-1.5">
          Type the account's email to confirm: <span className="font-mono text-ink-secondary">{expectedEmail}</span>
        </label>
        <input
          type="email"
          value={typedConfirm}
          onChange={(e) => setTypedConfirm(e.target.value)}
          placeholder={expectedEmail}
          autoComplete="off"
          className="w-full mb-3 px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </ConfirmDialog>

      {/* Promote / demote confirmation */}
      <ConfirmDialog
        open={pendingRole !== null}
        title={
          pendingRole?.newRole === 'admin'
            ? `Promote ${pendingRole?.user.full_name ?? 'this user'} to admin?`
            : `Demote ${pendingRole?.user.full_name ?? 'this user'}?`
        }
        description={
          pendingRole?.newRole === 'admin'
            ? 'Admins can read every conversation, see every profile in full, and promote or remove other accounts. Make sure this is what you want.'
            : 'They lose admin powers immediately. You can re-promote them later from this same panel.'
        }
        confirmLabel={savingRole ? 'Saving…' : pendingRole?.newRole === 'admin' ? 'Yes, promote' : 'Yes, demote'}
        confirmDisabled={savingRole || !pendingRole}
        destructive={pendingRole?.newRole === 'admin'}
        onConfirm={() => { if (pendingRole) void setRole(pendingRole.user, pendingRole.newRole) }}
        onCancel={() => { if (!savingRole) setPendingRole(null) }}
      />
    </div>
  )
}
