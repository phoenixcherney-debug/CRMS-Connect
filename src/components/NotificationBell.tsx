import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { NOTIF_POLL_MS } from '../lib/constants'

/** Unread badge; counts once on sign-in and then on an interval. Previously it
 *  re-queried on every route change (location.pathname in the deps), which
 *  meant a recount per navigation on top of the interval (review PERF-05). */
export function NotificationBell() {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function count() {
      // Thread already models this; the bell polled forever in hidden tabs.
      if (document.visibilityState === 'hidden') return
      const { count: n } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (!cancelled) setUnread(n ?? 0)
    }
    count()
    const interval = setInterval(count, NOTIF_POLL_MS)
    // ...and catch up once as soon as the tab comes back.
    document.addEventListener('visibilitychange', count)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', count)
    }
  }, [user])

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-line/40 hover:text-ink"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[11px] font-semibold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
