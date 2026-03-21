import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useUnreadCount() {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  async function fetchCount() {
    if (!profile) return

    // Get all conversation IDs for this user
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)

    if (!convs || convs.length === 0) {
      setCount(0)
      return
    }

    const convIds = convs.map((c) => c.id)

    const { count: unread } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)
      .neq('sender_id', profile.id)
      .in('conversation_id', convIds)

    setCount(unread ?? 0)
  }

  useEffect(() => {
    if (!profile) return

    fetchCount()

    // Recount when any new message arrives or is marked read
    const channel = supabase
      .channel('unread-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchCount()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  return count
}
