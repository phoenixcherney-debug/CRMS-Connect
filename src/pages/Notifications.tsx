import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, MessageSquare, FileText, UserPlus, CheckCircle2, RefreshCw } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

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
  pending:  'Pending review',
  reviewed: 'Under review',
  accepted: 'Accepted — congrats!',
  rejected: 'Not selected',
}

export default function Notifications() {
  const { profile } = useAuth()
  const [items, setItems]     = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(quiet = false) {
    if (!profile) return
    if (quiet) setRefreshing(true)
    else setLoading(true)

    const notifs: NotifItem[] = []

    // ── Unread messages ───────────────────────────────────────────────────────
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)

    if (convs && convs.length > 0) {
      const convIds = convs.map((c) => c.id)
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, created_at, conversation_id, content, sender_id, profiles(full_name)')
        .in('conversation_id', convIds)
        .eq('is_read', false)
        .neq('sender_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)

      for (const m of msgs ?? []) {
        notifs.push({
          id:       `msg-${m.id}`,
          type:     'message',
          ts:       m.created_at,
          unread:   true,
          link:     `/messages/${m.conversation_id}`,
          title:    `New message from ${(m.profiles as any)?.full_name ?? 'someone'}`,
          subtitle: m.content.length > 100 ? `${m.content.slice(0, 100)}…` : m.content,
        })
      }
    }

    // ── Applications ─────────────────────────────────────────────────────────
    if (profile.role === 'student') {
      // Student: their submitted applications
      const { data: apps } = await supabase
        .from('applications')
        .select('id, created_at, status, job_id, jobs(title, company)')
        .eq('applicant_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30)

      for (const a of apps ?? []) {
        const jobTitle   = (a.jobs as any)?.title   ?? 'a position'
        const jobCompany = (a.jobs as any)?.company ?? ''
        // Mark as unread only for statuses that changed recently (not pending - that's the student's own action)
        const isActionable = a.status === 'accepted' || a.status === 'reviewed' || a.status === 'rejected'
        notifs.push({
          id:       `app-${a.id}`,
          type:     'app_out',
          ts:       a.created_at,
          unread:   isActionable,
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
    setRefreshing(false)
  }

  useEffect(() => { load() }, [profile?.id])

  const unreadCount = items.filter((i) => i.unread).length

  const ICON: Record<NotifType, typeof Bell> = {
    message: MessageSquare,
    app_out: FileText,
    app_in:  UserPlus,
  }
  const ICON_BG: Record<NotifType, string> = {
    message: 'bg-primary-muted text-primary',
    app_out: 'bg-amber-50 text-amber-600',
    app_in:  'bg-success-bg text-success',
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
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
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <CheckCircle2 size={36} className="mx-auto text-success mb-3" />
          <p className="text-ink font-medium">You're all caught up!</p>
          <p className="text-ink-muted text-sm mt-1">No notifications right now.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          {items.map((item) => {
            const Icon = ICON[item.type]
            const bgColor = ICON_BG[item.type]
            return (
              <Link
                key={item.id}
                to={item.link}
                className={`flex items-start gap-4 px-5 py-4 hover:bg-primary-faint transition-colors ${item.unread ? 'bg-primary-faint/60' : ''}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${bgColor}`}>
                  <Icon size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${item.unread ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5 line-clamp-1">{item.subtitle}</p>
                  <p className="text-xs text-ink-muted mt-1">
                    {formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}
                  </p>
                </div>

                {item.unread && (
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
