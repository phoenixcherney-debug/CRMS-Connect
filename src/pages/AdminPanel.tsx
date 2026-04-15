import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Shield, Users, Briefcase, Eye, Ban, RotateCcw, Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

type AdminUser = {
  id: string
  full_name: string
  role: string
  created_at: string
  banned_at: string | null
  onboarding_complete: boolean
  email: string
}

type AdminJob = {
  id: string
  title: string
  company: string
  created_at: string
  posted_by: string
  profiles: { full_name: string } | null
}

type Tab = 'users' | 'postings'

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [usersRes, jobsRes] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase
        .from('jobs')
        .select('id, title, company, created_at, posted_by, profiles(full_name)')
        .order('created_at', { ascending: false }),
    ])
    if (usersRes.data) setUsers(usersRes.data as AdminUser[])
    if (jobsRes.data) setJobs(jobsRes.data as AdminJob[])
    setLoading(false)
  }

  async function handleBan(userId: string) {
    setActionError(null)
    const { error } = await supabase.rpc('admin_ban_user', { target_id: userId })
    if (error) { setActionError(error.message); return }
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, banned_at: new Date().toISOString() } : u
    ))
  }

  async function handleUnban(userId: string) {
    setActionError(null)
    const { error } = await supabase.rpc('admin_unban_user', { target_id: userId })
    if (error) { setActionError(error.message); return }
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, banned_at: null } : u
    ))
  }

  async function handleDeleteJob(jobId: string) {
    setActionError(null)
    const { error } = await supabase.from('jobs').delete().eq('id', jobId)
    if (error) { setActionError(error.message); return }
    setJobs(prev => prev.filter(j => j.id !== jobId))
    setConfirmDeleteId(null)
  }

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase()
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    )
  })

  const filteredJobs = jobs.filter(j => {
    const q = search.toLowerCase()
    return (
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      (j.profiles?.full_name ?? '').toLowerCase().includes(q)
    )
  })

  function roleBadgeStyle(role: string) {
    if (role === 'student') return { backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }
    if (role === 'employer_mentor') return { backgroundColor: 'var(--color-accent-muted)', color: 'var(--color-accent-dark)' }
    return { backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-ink-secondary)' }
  }

  function roleLabel(role: string) {
    if (role === 'student') return 'Student'
    if (role === 'employer_mentor') return 'Employer/Mentor'
    return role
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-primary-muted)' }}
        >
          <Shield size={20} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
            Admin Panel
          </h1>
          <p className="text-xs text-ink-muted">Manage users and postings</p>
        </div>
      </div>

      {actionError && (
        <div
          className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm"
          style={{ backgroundColor: 'var(--color-error-bg)', borderColor: 'var(--color-error-border)', color: 'var(--color-error)' }}
        >
          <AlertCircle size={15} className="shrink-0" />
          {actionError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg mb-6 w-fit" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
        <button
          onClick={() => { setTab('users'); setSearch('') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'users' ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          <Users size={15} />
          Users ({users.length})
        </button>
        <button
          onClick={() => { setTab('postings'); setSearch('') }}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'postings' ? 'bg-surface text-ink shadow-sm' : 'text-ink-secondary hover:text-ink'
          }`}
        >
          <Briefcase size={15} />
          Postings ({jobs.length})
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          placeholder={tab === 'users' ? 'Search by name, email, or role…' : 'Search by title, company, or poster…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
            placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : tab === 'users' ? (
        /* ── Users Tab ─────────────────────────────────────────────────────── */
        <div className="rounded-xl border border-border overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">No users found.</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredUsers.map(user => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-hover transition-colors">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
                  >
                    {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink truncate">{user.full_name}</span>
                      <span
                        className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={roleBadgeStyle(user.role)}
                      >
                        {roleLabel(user.role)}
                      </span>
                      {user.banned_at && (
                        <span
                          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--color-error-bg)', color: 'var(--color-error)' }}
                        >
                          Banned
                        </span>
                      )}
                      {!user.onboarding_complete && !user.banned_at && (
                        <span
                          className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--color-surface-raised)', color: 'var(--color-ink-muted)' }}
                        >
                          Incomplete
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted truncate">{user.email}</p>
                  </div>

                  {/* Joined */}
                  <span className="text-xs text-ink-muted shrink-0 hidden sm:block">
                    {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      to={`/admin/users/${user.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: 'var(--color-primary)' }}
                      title="View user"
                    >
                      <Eye size={13} />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                    {user.banned_at ? (
                      <button
                        onClick={() => handleUnban(user.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-surface-raised"
                        style={{ color: 'var(--color-success)' }}
                        title="Unban user"
                      >
                        <RotateCcw size={13} />
                        <span className="hidden sm:inline">Unban</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBan(user.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-error-bg"
                        style={{ color: 'var(--color-error)' }}
                        title="Ban user"
                      >
                        <Ban size={13} />
                        <span className="hidden sm:inline">Ban</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── Postings Tab ──────────────────────────────────────────────────── */
        <div className="rounded-xl border border-border overflow-hidden">
          {filteredJobs.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-muted">No postings found.</div>
          ) : (
            <div className="divide-y divide-border">
              {filteredJobs.map(job => (
                <div key={job.id} className="flex items-center gap-3 px-4 py-3 bg-surface hover:bg-surface-hover transition-colors">
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--color-surface-raised)' }}
                  >
                    <Briefcase size={16} className="text-ink-muted" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{job.title}</p>
                    <p className="text-xs text-ink-muted truncate">
                      {job.company}
                      {job.profiles?.full_name && (
                        <span className="text-ink-placeholder"> · Posted by {job.profiles.full_name}</span>
                      )}
                    </p>
                  </div>

                  {/* Date */}
                  <span className="text-xs text-ink-muted shrink-0 hidden sm:block">
                    {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>

                  {/* Delete */}
                  <div className="shrink-0">
                    {confirmDeleteId === job.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-ink-muted hidden sm:inline">Delete?</span>
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="px-2 py-1 rounded text-xs font-semibold"
                          style={{ backgroundColor: 'var(--color-error)', color: '#ffffff' }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded text-xs font-semibold text-ink-secondary hover:bg-surface-raised"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(job.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-error-bg"
                        style={{ color: 'var(--color-error)' }}
                        title="Delete posting"
                      >
                        <Trash2 size={13} />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
