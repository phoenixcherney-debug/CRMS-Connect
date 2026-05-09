import { NavLink, Link, useNavigate } from 'react-router-dom'
import {
  Compass, Rss, Briefcase, Calendar, Users, Building2, Bell, Mail,
  LogOut, User, PlusSquare, ClipboardList, FileText, CalendarClock,
  Moon, Sun, Menu, X, BookOpen, CalendarCheck, Shield, Bookmark,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../types'
import { useTheme } from '../contexts/ThemeContext'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { useUnreadNotifications } from '../hooks/useUnreadNotifications'
import { initialsOf } from '../lib/initials'
import { usePendingMeetings } from '../hooks/usePendingMeetings'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

const BASE_NAV_HEAD = [
  { to: '/explore',       label: 'Explore',       icon: Compass  },
  { to: '/opportunities', label: 'Opportunities', icon: Briefcase },
] as const

const BASE_NAV_TAIL = [
  { to: '/notifications', label: 'Notifications',  icon: Bell     },
  { to: '/messages',      label: 'Messages',       icon: Mail     },
] as const

export default function Nav() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const unreadCount = useUnreadCount()
  const unreadNotifications = useUnreadNotifications()
  const pendingMeetings = usePendingMeetings()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isAuthed = !!user && !!profile
  const isAdmin = profile?.role === 'admin'
  const isEmployerMentor = profile?.role === 'employer_mentor'
  const isStudent = profile?.role === 'student'

  // One canonical destination for an employer's own listings: "My Opportunities"
  // (route /my-postings). The /postings route is the student-posts feed and is
  // labeled accordingly so the two are not confused.
  //
  // Audit M1 — split /people into role-specific lists. Students see "Mentors"
  // (→ /mentors); employers see "Students" (→ /students). Admin keeps the
  // legacy /people view because they want both at once.
  const directoryItem = isStudent
    ? { to: '/mentors' as const, label: 'Mentors' as const, icon: Users }
    : isEmployerMentor
      ? { to: '/students' as const, label: 'Students' as const, icon: Users }
      : { to: '/people' as const, label: 'People' as const, icon: Users }

  const NAV_ITEMS = [
    ...BASE_NAV_HEAD, // Explore, Opportunities
    ...(isStudent ? [
      { to: '/applications' as const, label: 'Applications' as const, icon: FileText },
    ] : []),
    ...(isEmployerMentor ? [
      { to: '/my-opportunities' as const, label: 'My Opportunities' as const, icon: ClipboardList },
    ] : []),
    directoryItem,
    ...BASE_NAV_TAIL, // Notifications, Messages
  ]

  const SECONDARY_ITEMS = [
    { to: '/profile', label: 'Profile', icon: User },
    // M-07 — bookmarking opportunities is a student concept; hide for E/M & admin.
    ...(isStudent ? [
      { to: '/saved' as const, label: 'Saved' as const, icon: Bookmark },
    ] : []),
    ...(isAdmin ? [
      { to: '/admin', label: 'Admin Panel', icon: Shield },
      { to: '/admin/pending-accounts', label: 'Pending Accounts', icon: Shield },
      { to: '/admin/reports', label: 'Reports', icon: Shield },
    ] : []),
    ...(isEmployerMentor ? [
      { to: '/opportunities/new',  label: 'Post an Opportunity', icon: PlusSquare  },
      { to: '/student-posts',      label: 'Student Posts',       icon: BookOpen    },
    ] : []),
    ...(isStudent ? [
      { to: '/student-posts/mine', label: 'My Post', icon: BookOpen },
    ] : []),
    // P2-33 — Availability is mentor-only (the page sets DM slots students
    // can request meetings for); hide the menu item for students.
    ...(isEmployerMentor ? [
      { to: '/availability' as const, label: 'Availability' as const, icon: CalendarClock },
    ] : []),
    { to: '/meetings', label: 'Meetings', icon: CalendarCheck },
    { to: '/activity', label: 'Activity', icon: Rss      },
    { to: '/events',   label: 'Events', icon: Calendar  },
    ...(isStudent ? [
      { to: '/employers', label: 'Employers & Mentors', icon: Building2 },
      // Audit M11 — students can also browse other students.
      { to: '/students', label: 'Students', icon: Users },
    ] : []),
  ]

  const initials = initialsOf(profile?.full_name)

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    // M-10 — Esc closes the open menu (a11y).
    function keyHandler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [open])

  const [logoError, setLogoError] = useState(false)

  const menuItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-primary-muted text-primary'
        : 'text-ink-secondary hover:bg-primary-faint hover:text-ink'
    }`

  const roleLabel = profile?.role ? (ROLE_LABELS[profile.role] ?? 'Student') : 'Student'

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
              <button type="button"
                onClick={toggleTheme}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,0.7)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                aria-controls="primary-nav-menu"
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

          </div>
        </div>
      </nav>

      {open && (
        <div
          id="primary-nav-menu"
          className="fixed inset-x-0 z-30 border-b border-border overflow-y-auto"
          style={{
            top: 'calc(3.5rem + 2px + env(safe-area-inset-top))',
            maxHeight: 'calc(100vh - 3.5rem - 2px - env(safe-area-inset-top))',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          <div className="max-w-7xl mx-auto">
            {!isAuthed && (
              <div className="py-2">
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-primary-faint hover:text-ink transition-colors"
                >
                  Create an account
                </Link>
              </div>
            )}
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

            {isAuthed && (<>
            <div className="py-1">
              <p className="px-4 pt-2 pb-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                Navigation
              </p>
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                const isInbox = label === 'Messages'
                // P2-31 — bell badge for unread notifications.
                const isBell  = label === 'Notifications'
                const badgeCount = isInbox ? unreadCount : isBell ? unreadNotifications : 0
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={menuItemClass}
                  >
                    <div className="relative">
                      <Icon size={17} className="shrink-0" />
                      {(isInbox || isBell) && badgeCount > 0 && (
                        <span
                          className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full text-[9px] font-bold leading-none"
                          style={{ backgroundColor: 'var(--color-error)', color: '#ffffff' }}
                        >
                          {badgeCount > 9 ? '9+' : badgeCount}
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
              <button type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-error-bg hover:text-error transition-colors"
              >
                <LogOut size={17} className="shrink-0" />
                Sign out
              </button>
            </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}
