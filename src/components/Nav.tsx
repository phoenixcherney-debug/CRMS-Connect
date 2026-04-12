import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  Compass, Rss, Briefcase, Calendar, Users, Building2, Bell, Mail,
  LogOut, User, PlusSquare, ClipboardList, FileText, CalendarClock,
  Moon, Sun, Menu, X, BookOpen, CalendarCheck,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { usePendingMeetings } from '../hooks/usePendingMeetings'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

const BASE_NAV = [
  { to: '/explore',       label: 'Explore',       icon: Compass  },
  { to: '/jobs',          label: 'Jobs',           icon: Briefcase },
  { to: '/people',        label: 'People',         icon: Users    },
  { to: '/notifications', label: 'Notifications',  icon: Bell     },
  { to: '/messages',      label: 'Inbox',          icon: Mail     },
] as const

export default function Nav() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const unreadCount = useUnreadCount()
  const pendingMeetings = usePendingMeetings()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isEmployerMentor = profile?.role === 'employer_mentor'
  const isStudent = profile?.role === 'student'

  const NAV_ITEMS = [
    ...BASE_NAV.slice(0, 2), // Explore, Jobs
    ...(isStudent ? [
      { to: '/my-applications' as const, label: 'Applications' as const, icon: FileText },
    ] : []),
    ...(isEmployerMentor ? [
      { to: '/postings' as const, label: 'Postings' as const, icon: ClipboardList },
    ] : []),
    ...BASE_NAV.slice(2), // People, Notifications, Inbox
  ]

  const SECONDARY_ITEMS = [
    { to: '/profile', label: 'Profile', icon: User },
    ...(isEmployerMentor ? [
      { to: '/jobs/new',     label: 'Post an Opportunity', icon: PlusSquare  },
      { to: '/my-postings',  label: 'My Opportunities',    icon: ClipboardList },
    ] : []),
    ...(isStudent ? [
      { to: '/my-posts', label: 'My Posts', icon: BookOpen },
    ] : []),
    { to: '/availability', label: 'My Calendar', icon: CalendarClock },
    { to: '/meetings', label: 'Meetings', icon: CalendarCheck },
    { to: '/feed',    label: 'Activity', icon: Rss      },
    { to: '/events',  label: 'Events', icon: Calendar  },
    ...(isStudent ? [
      { to: '/employers', label: 'Employers & Mentors', icon: Building2 },
    ] : []),
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

  const [logoError, setLogoError] = useState(false)

  const menuItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-muted text-primary'
        : 'text-ink-secondary hover:bg-primary-faint hover:text-ink'
    }`

  const roleLabel = profile?.role === 'employer_mentor' ? 'Employer / Mentor' : 'Student'

  return (
    <div ref={menuRef}>
      <nav
        className="sticky top-0 z-40"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: `
            radial-gradient(ellipse 80% 60% at 80% 20%, rgba(74,124,47,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 20% 80%, rgba(45,80,22,0.5) 0%, transparent 50%),
            linear-gradient(155deg, #2D5016 0%, #3A6B1E 35%, #4A7C2F 65%, #3A6B1E 100%)
          `,
          borderBottom: '2px solid rgba(255,255,255,0.1)',
          boxShadow: 'var(--shadow-nav)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">

            <Link to="/explore" className="flex items-center gap-3 shrink-0">
              {logoError ? (
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-md"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <span className="text-sm font-black text-white">C</span>
                </div>
              ) : (
                <img
                  src={CRMS_LOGO}
                  alt="CRMS"
                  className="h-8 w-auto object-contain brightness-0 invert"
                  onError={() => setLogoError(true)}
                />
              )}
              <div className="w-px h-6" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }} />
              <span
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: 'var(--font-serif)', color: '#ffffff' }}
              >
                Connect
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                aria-label={open ? 'Close menu' : 'Open menu'}
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

          </div>
        </div>
      </nav>

      {open && (
        <div
          className="fixed inset-x-0 z-30 border-b border-border overflow-y-auto"
          style={{
            top: 'calc(3.5rem + 2px + env(safe-area-inset-top))',
            maxHeight: 'calc(100vh - 3.5rem - 2px - env(safe-area-inset-top))',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          <div className="max-w-7xl mx-auto">
            {profile && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{profile.full_name}</p>
                  <p className="text-xs text-ink-muted">{roleLabel}</p>
                </div>
              </div>
            )}

            <div className="py-1">
              <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                Navigation
              </p>
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                const isInbox = label === 'Inbox'
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={menuItemClass}
                  >
                    <div className="relative">
                      <Icon size={17} className="shrink-0" />
                      {isInbox && unreadCount > 0 && (
                        <span
                          className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-bold leading-none"
                          style={{ backgroundColor: 'var(--color-error)', color: '#ffffff' }}
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    {label}
                  </NavLink>
                )
              })}
            </div>

            <div className="py-1 border-t border-border">
              <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                More
              </p>
              {SECONDARY_ITEMS.map(({ to, label, icon: Icon }) => {
                const isMeetings = label === 'Meetings'
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={menuItemClass}
                  >
                    <div className="relative">
                      <Icon size={17} className="shrink-0" />
                      {isMeetings && pendingMeetings > 0 && (
                        <span
                          className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-bold leading-none"
                          style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
                        >
                          {pendingMeetings > 9 ? '9+' : pendingMeetings}
                        </span>
                      )}
                    </div>
                    {label}
                  </NavLink>
                )
              })}
            </div>

            <div className="py-2 border-t border-border">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-error-bg hover:text-error transition-colors"
              >
                <LogOut size={17} className="shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
