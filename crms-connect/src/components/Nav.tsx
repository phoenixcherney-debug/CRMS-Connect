import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Briefcase,
  MessageSquare,
  User,
  LogOut,
  PlusSquare,
  ClipboardList,
  FileText,
  Menu,
  X,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useUnreadCount } from '../hooks/useUnreadCount'

export default function Nav() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const unreadCount = useUnreadCount()
  const [open, setOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/login')
  }

  // Close menu when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isStudent = profile?.role === 'student'
  const isPoster = profile?.role === 'alumni' || profile?.role === 'parent'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-primary-muted text-primary'
        : 'text-ink-secondary hover:bg-primary-faint hover:text-ink'
    }`

  return (
    <div className="sticky top-0 z-40" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Collapsed toggle button — always visible */}
      {!navOpen && (
        <div className="flex justify-end px-3 pt-2">
          <button
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface border border-border shadow-sm text-ink-secondary hover:bg-primary-faint transition-colors"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            {unreadCount > 0 ? (
              <div className="relative">
                <Menu size={20} />
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-white text-[9px] font-bold leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              </div>
            ) : (
              <Menu size={20} />
            )}
          </button>
        </div>
      )}

      {/* Expanded nav bar */}
      {navOpen && (
        <nav className="border-b border-border bg-surface shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              {/* Logo */}
              <Link to="/jobs" className="shrink-0 flex items-center" onClick={() => { setOpen(false); setNavOpen(false) }}>
                <img
                  src="https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png"
                  alt="Colorado Rocky Mountain School"
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    const el = e.currentTarget
                    el.style.display = 'none'
                    const fallback = el.nextElementSibling as HTMLElement | null
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
                <span
                  className="hidden items-center gap-2 text-primary font-bold text-lg tracking-tight"
                  style={{ display: 'none' }}
                >
                  <span className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-white text-xs font-black">C</span>
                  CRMS Connect
                </span>
              </Link>

              <div className="flex items-center gap-1" ref={menuRef}>
                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  title="Sign out"
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-secondary hover:bg-error-bg hover:text-error transition-colors"
                >
                  <LogOut size={16} />
                </button>

                {/* Collapse nav */}
                <button
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-secondary hover:bg-primary-faint transition-colors"
                  onClick={() => { setOpen(false); setNavOpen(false) }}
                  aria-label="Collapse navigation"
                >
                  <X size={20} />
                </button>

                {/* Hamburger / dropdown toggle */}
                <button
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-secondary hover:bg-primary-faint transition-colors"
                  onClick={() => setOpen((o) => !o)}
                  aria-label="Toggle menu"
                >
                  {open ? <X size={20} /> : <Menu size={20} />}
                </button>

                {/* Floating dropdown */}
                {open && (
                  <div className="absolute top-14 right-0 w-56 bg-surface border border-border rounded-xl shadow-lg py-2 z-50"
                    style={{ boxShadow: 'var(--shadow-modal)' }}
                  >
                    <div className="px-3 pb-2 mb-1 border-b border-border">
                      <p className="text-sm font-medium text-ink">{profile?.full_name}</p>
                      <p className="text-xs text-ink-muted capitalize">{profile?.role}</p>
                    </div>

                    <div className="px-2 space-y-0.5">
                      <NavLink to="/jobs" className={linkClass} onClick={() => setOpen(false)}>
                        <Briefcase size={16} />
                        <span>Jobs</span>
                      </NavLink>

                      {isPoster && (
                        <NavLink to="/jobs/new" className={linkClass} onClick={() => setOpen(false)}>
                          <PlusSquare size={16} />
                          <span>Post a Job</span>
                        </NavLink>
                      )}
                      {isPoster && (
                        <NavLink to="/my-postings" className={linkClass} onClick={() => setOpen(false)}>
                          <ClipboardList size={16} />
                          <span>My Postings</span>
                        </NavLink>
                      )}

                      {isStudent && (
                        <NavLink to="/my-applications" className={linkClass} onClick={() => setOpen(false)}>
                          <FileText size={16} />
                          <span>My Applications</span>
                        </NavLink>
                      )}

                      <NavLink to="/messages" className={linkClass} onClick={() => setOpen(false)}>
                        <div className="relative">
                          <MessageSquare size={16} />
                          {unreadCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </div>
                        <span>Messages</span>
                        {unreadCount > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </NavLink>

                      <NavLink to="/profile" className={linkClass} onClick={() => setOpen(false)}>
                        <User size={16} />
                        <span>Profile</span>
                      </NavLink>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}
    </div>
  )
}
