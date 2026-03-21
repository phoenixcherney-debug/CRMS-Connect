import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell, Briefcase, CheckCircle2, XCircle, Eye, MessageSquare,
  Clock,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { markNotificationsSeen } from '../hooks/useHasUnreadNotifications'
import type { Application, Job } from '../types'
import Spinner from '../components/Spinner'

interface NotificationItem {
  id: string
  type: 'application_update' | 'new_applicant' | 'unread_messages'
  title: string
  subtitle: string
  timestamp: string
  link: string
  icon: 'accepted' | 'rejected' | 'reviewed' | 'pending' | 'applicant' | 'message'
}

export default function Notifications() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const isStudent = profile?.role === 'student'

  useEffect(() => {
    markNotificationsSeen()
  }, [])

  useEffect(() => {
    async function load() {
      if (!profile) return
      const items: NotificationItem[] = []

      if (isStudent) {
        // Fetch application status updates
        const { data: apps } = await supabase
          .from('applications')
          .select('*, jobs(id, title, company)')
          .eq('applicant_id', profile.id)
          .order('created_at', { ascending: false })

        for (const app of (apps as (Application & { jobs: Job })[]) ?? []) {
          items.push({
            id: `app-${app.id}`,
            type: 'application_update',
            title: app.status === 'accepted'
              ? `Congratulations! You've been accepted`
              : app.status === 'rejected'
              ? `Application update`
              : app.status === 'reviewed'
              ? `Your application is being reviewed`
              : `Application submitted`,
            subtitle: `${app.jobs?.title} at ${app.jobs?.company}`,
            timestamp: app.created_at,
            link: `/jobs/${app.jobs?.id}`,
            icon: app.status,
          })
        }
      } else {
        // Fetch new applications to their jobs
        const { data: myJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('posted_by', profile.id)

        if (myJobs && myJobs.length > 0) {
          const jobIds = myJobs.map((j) => j.id)
          const { data: apps } = await supabase
            .from('applications')
            .select('*, jobs(id, title, company), profiles(full_name)')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false })

          for (const app of (apps as any[]) ?? []) {
            items.push({
              id: `applicant-${app.id}`,
              type: 'new_applicant',
              title: `${app.profiles?.full_name ?? 'Someone'} applied`,
              subtitle: `${app.jobs?.title} at ${app.jobs?.company}`,
              timestamp: app.created_at,
              link: `/jobs/${app.jobs?.id}/applicants`,
              icon: 'applicant',
            })
          }
        }
      }

      // Unread messages for everyone
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, participant_one, participant_two')
        .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)

      if (convs && convs.length > 0) {
        const convIds = convs.map((c) => c.id)
        const { data: unread } = await supabase
          .from('messages')
          .select('*, conversations!inner(participant_one, participant_two)')
          .in('conversation_id', convIds)
          .eq('is_read', false)
          .neq('sender_id', profile.id)
          .order('created_at', { ascending: false })

        // Get sender profiles
        const senderIds = [...new Set((unread ?? []).map((m: any) => m.sender_id))]
        const { data: senderProfiles } = senderIds.length > 0
          ? await supabase.from('profiles').select('id, full_name').in('id', senderIds)
          : { data: [] }
        const senderMap = Object.fromEntries((senderProfiles ?? []).map((p: any) => [p.id, p.full_name]))

        // Group by conversation
        const convGroups = new Map<string, any[]>()
        for (const msg of unread ?? []) {
          if (!convGroups.has(msg.conversation_id)) convGroups.set(msg.conversation_id, [])
          convGroups.get(msg.conversation_id)!.push(msg)
        }

        for (const [convId, msgs] of convGroups) {
          const latest = msgs[0]
          const senderName = senderMap[latest.sender_id] ?? 'Someone'
          items.push({
            id: `msg-${convId}`,
            type: 'unread_messages',
            title: `${msgs.length} unread message${msgs.length > 1 ? 's' : ''} from ${senderName}`,
            subtitle: latest.content.length > 60
              ? latest.content.slice(0, 60) + '…'
              : latest.content,
            timestamp: latest.created_at,
            link: `/inbox/${convId}`,
            icon: 'message',
          })
        }
      }

      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      setNotifications(items)
      setLoading(false)
    }
    load()
  }, [profile?.id])

  function getIcon(icon: NotificationItem['icon']) {
    switch (icon) {
      case 'accepted':
        return <div className="w-10 h-10 rounded-lg bg-success-bg flex items-center justify-center"><CheckCircle2 size={20} className="text-success" /></div>
      case 'rejected':
        return <div className="w-10 h-10 rounded-lg bg-error-bg flex items-center justify-center"><XCircle size={20} className="text-error" /></div>
      case 'reviewed':
        return <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Eye size={20} className="text-blue-600" /></div>
      case 'pending':
        return <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Clock size={20} className="text-amber-600" /></div>
      case 'applicant':
        return <div className="w-10 h-10 rounded-lg bg-primary-muted flex items-center justify-center"><Briefcase size={20} className="text-primary" /></div>
      case 'message':
        return <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center"><MessageSquare size={20} className="text-purple-600" /></div>
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Notifications</h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <Bell size={36} className="text-ink-muted mx-auto mb-3" />
          <p className="text-ink-muted text-sm font-medium">No notifications yet</p>
          <p className="text-ink-muted text-xs mt-1">
            {isStudent
              ? 'Apply to opportunities to see updates here.'
              : 'Post an opportunity to see applicant notifications here.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {notifications.map((notif) => (
            <Link
              key={notif.id}
              to={notif.link}
              className="flex gap-4 px-5 py-4 hover:bg-primary-faint transition-colors"
            >
              {getIcon(notif.icon)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink">{notif.title}</p>
                <p className="text-xs text-ink-secondary mt-0.5 truncate">{notif.subtitle}</p>
                <p className="text-xs text-ink-muted mt-1">
                  {formatDistanceToNow(parseISO(notif.timestamp), { addSuffix: true })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
