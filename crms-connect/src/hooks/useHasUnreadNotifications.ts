import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const STORAGE_KEY = 'notifications_last_seen'

export function useHasUnreadNotifications() {
  const { profile } = useAuth()
  const [hasUnread, setHasUnread] = useState(false)

  async function check() {
    if (!profile) return

    const lastSeen = localStorage.getItem(STORAGE_KEY) ?? '1970-01-01T00:00:00.000Z'

    if (profile.role === 'student') {
      // Any application that changed status (reviewed/accepted/rejected) after last seen
      const { count } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', profile.id)
        .neq('status', 'pending')
        .gt('created_at', lastSeen)

      if ((count ?? 0) > 0) { setHasUnread(true); return }
    } else {
      // Any new applicants to their jobs after last seen
      const { data: myJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('posted_by', profile.id)

      if (myJobs && myJobs.length > 0) {
        const { count } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .in('job_id', myJobs.map((j) => j.id))
          .gt('created_at', lastSeen)

        if ((count ?? 0) > 0) { setHasUnread(true); return }
      }
    }

    // Unread messages for everyone
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)

    if (convs && convs.length > 0) {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convs.map((c) => c.id))
        .eq('is_read', false)
        .neq('sender_id', profile.id)
        .gt('created_at', lastSeen)

      if ((count ?? 0) > 0) { setHasUnread(true); return }
    }

    setHasUnread(false)
  }

  useEffect(() => {
    if (!profile) return
    check()

    const channel = supabase
      .channel('notif-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, check)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'applications' }, check)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, check)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  return hasUnread
}

export function markNotificationsSeen() {
  localStorage.setItem(STORAGE_KEY, new Date().toISOString())
}
