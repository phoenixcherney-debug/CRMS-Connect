import { Link, useNavigate } from 'react-router-dom'
import {
  Newspaper, CalendarDays, Users, Building2,
  User, ClipboardList, FileText, LogOut, Briefcase,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../types'

export default function MenuPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const isStudent = profile?.role === 'student'
  const isPoster = profile?.role === 'alumni' || profile?.role === 'parent'

  const initials = profile?.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Profile card */}
      <Link
        to="/profile"
        className="flex items-center gap-4 bg-surface rounded-2xl border border-border p-5 mb-6 hover:shadow-md transition-shadow"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="w-14 h-14 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-lg shrink-0 overflow-hidden">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            initials
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-lg truncate">{profile?.full_name}</p>
          <p className="text-sm text-ink-muted capitalize">{profile ? ROLE_LABELS[profile.role] : ''}</p>
        </div>
      </Link>

      {/* Menu items */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="px-4 py-2 border-b border-border">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Discover</p>
        </div>
        <MenuItem to="/feed" icon={Newspaper} label="Feed" sub="Latest community activity" />
        <MenuItem to="/events" icon={CalendarDays} label="Events" sub="Upcoming deadlines & dates" />
        <MenuItem to="/people" icon={Users} label="People" sub="Community directory" />
        <MenuItem to="/employers" icon={Building2} label="Employers" sub="Companies with listings" />

        <div className="px-4 py-2 border-t border-b border-border">
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wider">Your Activity</p>
        </div>
        {isPoster && (
          <>
            <MenuItem to="/jobs/new" icon={Briefcase} label="Post a Job" sub="Share an opportunity" />
            <MenuItem to="/my-postings" icon={ClipboardList} label="My Postings" sub="Manage your listings" />
          </>
        )}
        {isStudent && (
          <MenuItem to="/my-applications" icon={FileText} label="My Applications" sub="Track your applications" />
        )}
        <MenuItem to="/profile" icon={User} label="Profile" sub="View & edit your profile" />
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full mt-4 flex items-center gap-3 bg-surface rounded-2xl border border-border px-5 py-4
          text-left hover:bg-error-bg hover:border-red-200 transition-colors"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <LogOut size={20} className="text-error" />
        <span className="text-sm font-medium text-error">Sign out</span>
      </button>
    </div>
  )
}

function MenuItem({ to, icon: Icon, label, sub }: {
  to: string
  icon: React.ComponentType<{ size: number; className?: string }>
  label: string
  sub: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-primary-faint transition-colors"
    >
      <Icon size={20} className="text-ink-secondary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-muted">{sub}</p>
      </div>
    </Link>
  )
}
