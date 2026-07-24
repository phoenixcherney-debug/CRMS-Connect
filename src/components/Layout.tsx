import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useSignOut } from '../lib/useSignOut'
import { NotificationBell } from './NotificationBell'
import { Avatar } from './ui/Avatar'

const NAV_LINK = 'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors'
const NAV_ACTIVE = 'bg-meadow text-pine'
const NAV_IDLE = 'text-faint hover:text-ink hover:bg-line/40'

export function Layout() {
  const { profile } = useAuth()
  const signOutAndGo = useSignOut()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  // Menus close on navigation: NavLink/Link clicks call closeMenus directly
  // (a pathname effect would be a sync setState in an effect).
  const closeMenus = () => {
    setMenuOpen(false)
    setMobileOpen(false)
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!profile) return null

  const links: { to: string; label: string }[] =
    profile.role === 'student'
      ? [
          { to: '/board', label: 'The Board' },
          { to: '/requests', label: 'My requests' },
        ]
      : profile.role === 'member'
        ? [
            { to: '/home', label: 'My offers' },
            { to: '/board', label: 'The Board' },
          ]
        : [
            { to: '/admin', label: 'Staff desk' },
            { to: '/board', label: 'The Board' },
          ]

  async function handleSignOut() {
    closeMenus()
    await signOutAndGo()
  }

  // Escape closes the account menu and returns focus to its trigger.
  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setMenuOpen(false)
      menuTriggerRef.current?.focus()
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-pine focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
          <Link to="/home" className="font-display text-xl font-semibold text-pine">
            CRMS Connect
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/home' || l.to === '/admin'}
                className={({ isActive }) => `${NAV_LINK} ${isActive ? NAV_ACTIVE : NAV_IDLE}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {profile.role === 'member' && (
              <Link
                to="/offers/new"
                className="hidden rounded-lg bg-clay px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-clay-deep sm:inline-block"
              >
                Open a door
              </Link>
            )}
            <NotificationBell />
            <div className="relative" ref={menuRef} onKeyDown={onMenuKeyDown}>
              <button
                type="button"
                ref={menuTriggerRef}
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex items-center rounded-full"
              >
                <Avatar name={profile.full_name} size="sm" staff={profile.role === 'admin'} />
              </button>
              {menuOpen && (
                // Plain, Tab-navigable items (no role="menu": we don't implement
                // the full APG menu keyboard model). Escape closes + returns focus.
                <div className="absolute right-0 top-11 w-48 rounded-xl border border-line bg-card p-1.5 shadow-sm">
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium text-ink">{profile.full_name}</p>
                  </div>
                  <Link to="/profile" onClick={closeMenus} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-meadow">
                    My profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-meadow"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-line/40 hover:text-ink sm:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav aria-label="Primary mobile" className="border-t border-line px-4 py-3 sm:hidden">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/home' || l.to === '/admin'}
                  onClick={closeMenus}
                  className={({ isActive }) => `${NAV_LINK} ${isActive ? NAV_ACTIVE : NAV_IDLE}`}
                >
                  {l.label}
                </NavLink>
              ))}
              {profile.role === 'member' && (
                <Link to="/offers/new" onClick={closeMenus} className="mt-1 rounded-lg bg-clay px-3 py-2 text-center text-sm font-medium text-white">
                  Open a door
                </Link>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-xs text-faint">
          <span>CRMS Connect — only for the CRMS community.</span>
          <Link to="/privacy" className="hover:text-ink">Privacy & safety</Link>
        </div>
      </footer>
    </div>
  )
}
