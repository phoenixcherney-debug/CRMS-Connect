import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  Compass, Rss, Briefcase, Calendar, Users, Building2, Bell, Mail,
  LogOut, ChevronDown, User, PlusSquare, ClipboardList, FileText,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnreadCount } from '../hooks/useUnreadCount'

// Base nav items (shared by all roles)
const BASE_NAV = [
  { to: '/explore',       label: 'Explore',       icon: Compass   },
  { to: '/jobs',          label: 'Jobs',           icon: Briefcase },
  { to: '/people',        label: 'People',         icon: Users     },
  { to: '/notifications', label: 'Notifications',  icon: Bell      },
  { to: '/messages',      label: 'Inbox',          icon: Mail      },
] as const

export default function Nav() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const unreadCount = useUnreadCount()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isPoster = profile?.role === 'alumni' || profile?.role === 'parent'
  const isStudent = profile?.role === 'student'

  // Build nav items based on role
  const NAV_ITEMS = [
    ...BASE_NAV.slice(0, 2), // Explore, Jobs
    ...(isStudent ? [{ to: '/my-applications' as const, label: 'Applications' as const, icon: FileText }] : []),
    ...(isPoster ? [{ to: '/my-postings' as const, label: 'Postings' as const, icon: ClipboardList }] : []),
    ...BASE_NAV.slice(2), // People, Notifications, Inbox
  ]

  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-primary-muted text-primary'
        : 'text-ink-secondary hover:bg-primary-faint hover:text-ink'
    }`

  return (
    <nav
      className="sticky top-0 z-40 bg-surface border-b border-border shadow-sm"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-3">

          {/* Logo */}
          <Link to="/explore" className="shrink-0 mr-1">
            <img
              src="https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png"
              alt="CRMS Connect"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                const el = e.currentTarget
                el.style.display = 'none'
                const fb = el.nextElementSibling as HTMLElement | null
                if (fb) fb.style.display = 'flex'
              }}
            />
            <span
              className="hidden items-center justify-center w-7 h-7 rounded-md bg-primary text-white text-xs font-black"
              style={{ display: 'none' }}
            >C</span>
          </Link>

          {/* Nav items — horizontally scrollable, no visible scrollbar */}
          <div
            className="flex-1 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div className="flex items-center gap-0.5 min-w-max">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                const isInbox = label === 'Inbox'
                return (
                  <NavLink key={to} to={to} className={itemClass}>
                    <div className="relative">
                      <Icon size={15} className="shrink-0" />
                      {isInbox && unreadCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold leading-none">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="hidden sm:inline">{label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>

          {/* User avatar + dropdown */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-primary-faint transition-colors"
              aria-label="Account menu"
            >
              <div className="w-7 h-7 rounded-full bg-primary-muted flex items-center justify-center text-primary text-xs font-bold overflow-hidden">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : initials}
              </div>
              <ChevronDown size={13} className="text-ink-muted hidden sm:block" />
            </button>

            {open && (
              <div
                className="absolute top-full right-0 mt-1 w-52 bg-surface border border-border rounded-xl py-2 z-50"
                style={{ boxShadow: 'var(--shadow-modal)' }}
              >
                <div className="px-3 pb-2 mb-1 border-b border-border">
                  <p className="text-sm font-medium text-ink truncate">{profile?.full_name}</p>
                  <p className="text-xs text-ink-muted capitalize">{profile?.role}</p>
                </div>

                <div className="px-2 space-y-0.5">
                  <NavLink
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className={itemClass}
                  >
                    <User size={15} /> Profile
                  </NavLink>

                  {isPoster && (
                    <NavLink
                      to="/jobs/new"
                      onClick={() => setOpen(false)}
                      className={itemClass}
                    >
                      <PlusSquare size={15} /> Post a Job
                    </NavLink>
                  )}

                  <NavLink
                    to="/feed"
                    onClick={() => setOpen(false)}
                    className={itemClass}
                  >
                    <Rss size={15} /> Feed
                  </NavLink>

                  <NavLink
                    to="/events"
                    onClick={() => setOpen(false)}
                    className={itemClass}
                  >
                    <Calendar size={15} /> Events
                  </NavLink>

                  <NavLink
                    to="/employers"
                    onClick={() => setOpen(false)}
                    className={itemClass}
                  >
                    <Building2 size={15} /> Employers
                  </NavLink>

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-ink-secondary hover:bg-error-bg hover:text-error transition-colors"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  )
}
