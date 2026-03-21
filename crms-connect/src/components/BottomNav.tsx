import { Link, useLocation } from 'react-router-dom'
import { Compass, Briefcase, MessageSquare, Bell, Menu } from 'lucide-react'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { useHasUnreadNotifications } from '../hooks/useHasUnreadNotifications'

const tabs = [
  { to: '/explore',       icon: Compass,       label: 'Explore', prefixes: ['/explore'] },
  { to: '/jobs',          icon: Briefcase,     label: 'Jobs',    prefixes: ['/jobs'] },
  { to: '/inbox',         icon: MessageSquare, label: 'Inbox',   prefixes: ['/inbox'], badge: 'count' as const },
  { to: '/notifications', icon: Bell,          label: 'Alerts',  prefixes: ['/notifications'], badge: 'dot' as const },
  { to: '/menu',          icon: Menu,          label: 'More',    prefixes: ['/menu', '/feed', '/events', '/people', '/employers', '/profile', '/my-postings', '/my-applications'] },
]

export default function BottomNav() {
  const unreadCount = useUnreadCount()
  const hasUnreadNotifs = useHasUnreadNotifications()
  const location = useLocation()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(216, 228, 207, 0.7)',
        boxShadow: 'var(--shadow-nav)',
      }}
    >
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.prefixes.some((p) => location.pathname.startsWith(p))

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className="flex flex-col items-center justify-center w-16 h-full"
            >
              <div
                className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all duration-200 ${
                  isActive ? 'bg-primary-muted' : ''
                }`}
              >
                <div className="relative">
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.3 : 1.8}
                    className={`transition-colors ${isActive ? 'text-primary' : 'text-ink-muted'}`}
                  />
                  {tab.badge === 'count' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  {tab.badge === 'dot' && hasUnreadNotifs && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white" />
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold leading-none transition-colors ${
                    isActive ? 'text-primary' : 'text-ink-muted'
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
