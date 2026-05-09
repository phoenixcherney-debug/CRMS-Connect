import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * P2-31 — count of unread notifications. Currently sources only from
 * the `notifications` table (DM events) since application-status and
 * meeting events haven't been migrated yet. Live-subscribes via
 * Realtime so the bell badge in the side menu updates without a
 * manual refresh.
 */
export function useUnreadNotifications() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile) {
      setCount(0)
      return
    }

    let mounted = true
    async function fetchCount() {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile!.id)
        .is('read_at', null)
      if (mounted) setCount(count ?? 0)
    }
    fetchCount()

    const channel = supabase
      .channel(`unread-notifications:${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchCount(),
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  return count
}
