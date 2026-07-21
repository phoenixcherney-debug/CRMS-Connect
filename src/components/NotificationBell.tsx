import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/** Unread badge; re-counts on route change and every 60s. */
export function NotificationBell() {
  const { user } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function count() {
      const { count: n } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (!cancelled) setUnread(n ?? 0)
    }
    count()
    const interval = setInterval(count, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user, location.pathname])

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-line/40 hover:text-ink"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
