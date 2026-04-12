import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function usePendingMeetings() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  async function fetchCount() {
    if (!profile) return
    const { count: c } = await supabase
      .from('meeting_requests')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', profile.id)
      .eq('status', 'pending')
    setCount(c ?? 0)
  }

  useEffect(() => {
    if (!profile) return
    fetchCount()

    const channel = supabase
      .channel('pending-meetings-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meeting_requests' }, fetchCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  return count
}
