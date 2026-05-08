import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, MessageSquare, FileText, UserPlus, CheckCircle2 } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

type NotifType = 'message' | 'app_out' | 'app_in'

interface NotifItem {
  id:       string
  type:     NotifType
  ts:       string
  unread:   boolean
  link:     string
  title:    string
  subtitle: string
}

const STATUS_TEXT: Record<string, string> = {
  pending:    'Submitted',
  reviewed:   'Submitted',
  waitlisted: 'Submitted',
  accepted:   'Accepted — congrats!',
  rejected:   'Not selected',
}

export default function Notifications() {
  const { profile } = useAuth()
  const [items, setItems]     = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(true)
  const [seenAt, setSeenAt] = useState<string | null>(null)

  async function load(quiet = false) {
    if (!profile) return
    if (!quiet) setLoading(true)

    // Fetch notifications_seen_at so we can dim items already seen
    const { data: profileData } = await supabase
      .from('profiles')
      .select('notifications_seen_at')
      .eq('id', profile.id)
      .single()
    const currentSeenAt: string | null = (profileData as any)?.notifications_seen_at ?? null
    setSeenAt(currentSeenAt)

    const notifs: NotifItem[] = []

    // ── DM notifications (NAV-005) ────────────────────────────────────────
    // Sourced from the explicit notifications table so DMs persist on the
    // page even after the recipient opens the thread (the message's
    // is_read=true now controls only the inbox-counter, not this list).
    const { data: dmRows } = await supabase
      .from('notifications')
      .select('id, source_id, link, title, subtitle, read_at, created_at')
      .eq('user_id', profile.id)
      .eq('kind', 'dm_received')
      .order('created_at', { ascending: false })
      .limit(20)

    for (const n of (dmRows ?? []) as { id: string; link: string; title: string; subtitle: string | null; read_at: string | null; created_at: string }[]) {
      notifs.push({
        id:       `dm-${n.id}`,
        type:     'message',
        ts:       n.created_at,
        unread:   !n.read_at,
        link:     n.link,
        title:    n.title,
        subtitle: n.subtitle ?? '',
      })
    }

    // ── Applications ─────────────────────────────────────────────────────────
    if (profile.role === 'student') {
      // Student: only show applications where the employer has done
      // something (accepted / rejected). The student's own submission isn't
      // notification-worthy — they did it themselves (audit task 15).
      const { data: apps } = await supabase
        .from('applications')
        .select('id, created_at, status, job_id, jobs(title, company)')
        .eq('applicant_id', profile.id)
        .in('status', ['accepted', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(30)

      for (const a of apps ?? []) {
        const jobTitle   = (a.jobs as any)?.title   ?? 'a position'
        const jobCompany = (a.jobs as any)?.company ?? ''
        notifs.push({
          id:       `app-${a.id}`,
          type:     'app_out',
          ts:       a.created_at,
          unread:   true,
          link:     `/jobs/${a.job_id}`,
          title:    `Application: ${jobTitle}${jobCompany ? ` at ${jobCompany}` : ''}`,
          subtitle: STATUS_TEXT[a.status] ?? a.status,
        })
      }
    } else {
      // Alumni / Parent: applicants on their jobs
      const { data: myJobs } = await supabase
        .from('jobs')
        .select('id, title, company')
        .eq('posted_by', profile.id)

      const jobIds = (myJobs ?? []).map((j: any) => j.id)
      if (jobIds.length > 0) {
        const jobMap = Object.fromEntries((myJobs ?? []).map((j: any) => [j.id, j]))
        const { data: apps } = await supabase
          .from('applications')
          .select('id, created_at, job_id, status, profiles(full_name)')
          .in('job_id', jobIds)
          .order('created_at', { ascending: false })
          .limit(30)

        for (const a of apps ?? []) {
          const job  = jobMap[a.job_id]
          const name = (a.profiles as any)?.full_name ?? 'Someone'
          // Mark new (pending) applications as unread for alumni/parents
          const isPending = (a as any).status === 'pending'
          notifs.push({
            id:       `app-${a.id}`,
            type:     'app_in',
            ts:       a.created_at,
            unread:   isPending,
            link:     `/jobs/${a.job_id}/applicants`,
            title:    `New applicant for ${job?.title ?? 'your posting'}`,
            subtitle: `${name} applied${job?.company ? ` · ${job.company}` : ''}`,
          })
        }
      }
    }

    notifs.sort((a, b) => b.ts.localeCompare(a.ts))
    setItems(notifs.slice(0, 50))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [profile?.id])

  // ── Realtime: re-fetch the feed when a new message lands or an application
  //    status changes. Without this the page is a snapshot at mount time —
  //    audit found Eve never saw Sam's "you have a new message" entry.
  useEffect(() => {
    if (!profile) return
    const ch = supabase
      .channel(`notifications:${profile.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => load(true))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id])

  // Mark all as seen when the page is visited
  useEffect(() => {
    if (!profile) return
    supabase.from('profiles').update({ notifications_seen_at: new Date().toISOString() }).eq('id', profile.id)
  }, [profile?.id])

  // An item is "new" if it arrived after the last seen timestamp
  const isNew = (item: NotifItem) => !seenAt || item.ts > seenAt
  const unreadCount = items.filter(isNew).length

  const ICON: Record<NotifType, typeof Bell> = {
    message: MessageSquare,
    app_out: FileText,
    app_in:  UserPlus,
  }
  const ICON_BG: Record<NotifType, string> = {
    message: 'bg-primary-muted text-primary',
    app_out: 'bg-notif-app-out-bg text-notif-app-out-text',
    app_in:  'bg-success-bg text-success',
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2" style={{ fontFamily: 'var(--font-serif)' }}>
          Notifications
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-primary text-white text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </h1>
        <p className="text-ink-secondary text-sm mt-0.5">
          {loading ? 'Loading…' : `${items.length} recent notification${items.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="You're all caught up!"
          description="No notifications right now."
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          {items.map((item) => {
            const Icon = ICON[item.type]
            const bgColor = ICON_BG[item.type]
            return (
              <Link
                key={item.id}
                to={item.link}
                className={`flex items-start gap-4 px-5 py-4 hover:bg-primary-faint transition-colors ${isNew(item) ? 'bg-primary-faint/60' : ''}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${bgColor}`}>
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${isNew(item) ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5 line-clamp-1">{item.subtitle}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    {formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}
                  </p>
                </div>

                {isNew(item) && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
