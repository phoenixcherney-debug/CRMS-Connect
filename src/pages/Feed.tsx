import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Bell, RefreshCw, MessageSquare, UserCheck } from 'lucide-react'
import { formatDistanceToNow, parseISO, isPast } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Application } from '../types'
import { OPPORTUNITY_TYPE_LABELS, JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

interface MsgItem {
  conversation_id: string
  sender_name: string
  content: string
  created_at: string
}

type FeedItem =
  | { kind: 'job';         ts: string; job:  Job;         key: string }
  | { kind: 'application'; ts: string; app:  Application; key: string }
  | { kind: 'message';     ts: string; msg:  MsgItem;     key: string }

export default function Feed() {
  const { profile } = useAuth()
  const isStudent       = profile?.role === 'student'
  const isEmployerMentor = profile?.role === 'employer_mentor'

  const [items, setItems]         = useState<FeedItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(quiet = false) {
    if (!profile) return
    if (quiet) setRefreshing(true)
    else setLoading(true)

    const feed: FeedItem[] = []

    // ── Students: matching opportunities ────────────────────────────────────
    if (isStudent) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*, profiles(id, full_name, role)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(40)

      const studentInterests = profile.interests ?? []
      for (const j of (jobs as Job[]) ?? []) {
        if (j.deadline && isPast(parseISO(j.deadline))) continue
        // Filter by student interests when set
        if (studentInterests.length > 0 && j.industry && !studentInterests.includes(j.industry)) continue
        feed.push({ kind: 'job', ts: j.created_at, job: j, key: `job-${j.id}` })
      }
    }

    // ── Employer/Mentors: applications to their jobs ─────────────────────────
    if (isEmployerMentor) {
      const { data: myJobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('posted_by', profile.id)

      const myJobIds = ((myJobs ?? []) as { id: string }[]).map((j) => j.id)

      if (myJobIds.length > 0) {
        const { data: apps } = await supabase
          .from('applications')
          .select('*, profiles(id, full_name, avatar_url, graduation_year, grade), jobs(id, title, company)')
          .in('job_id', myJobIds)
          .order('created_at', { ascending: false })
          .limit(40)

        for (const app of (apps as Application[]) ?? []) {
          feed.push({ kind: 'application', ts: app.created_at, app: app as Application, key: `app-${app.id}` })
        }
      }
    }

    // ── Both roles: recent messages from others ──────────────────────────────
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)

    const convoIds = ((convos ?? []) as { id: string }[]).map((c) => c.id)

    if (convoIds.length > 0) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, content, created_at, conversation_id, sender_id, profiles(full_name)')
        .in('conversation_id', convoIds)
        .neq('sender_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)

      // One entry per conversation (the latest message)
      const seen = new Set<string>()
      for (const m of (msgs ?? []) as unknown as {
        id: string
        content: string
        created_at: string
        conversation_id: string
        sender_id: string
        profiles: { full_name: string } | null
      }[]) {
        if (seen.has(m.conversation_id)) continue
        seen.add(m.conversation_id)
        feed.push({
          kind: 'message',
          ts: m.created_at,
          msg: {
            conversation_id: m.conversation_id,
            sender_name: m.profiles?.full_name ?? 'Someone',
            content: m.content,
            created_at: m.created_at,
          },
          key: `msg-${m.conversation_id}`,
        })
      }
    }

    feed.sort((a, b) => b.ts.localeCompare(a.ts))
    setItems(feed.slice(0, 50))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [profile?.id])

  const subtitle = isStudent
    ? 'Opportunities matching your interests and recent messages'
    : 'New applications to your postings and recent messages'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Feed</h1>
          <p className="text-ink-secondary text-sm mt-0.5">{subtitle}</p>
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
          <Bell size={32} className="mx-auto text-ink-muted mb-3" />
          <p className="text-ink-muted font-medium">Nothing here yet.</p>
          <p className="text-xs text-ink-muted mt-1">Activity will appear as the community grows.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            // ── Job opportunity card ─────────────────────────────────────────
            if (item.kind === 'job') {
              const typeLabel = item.job.opportunity_type
                ? OPPORTUNITY_TYPE_LABELS[item.job.opportunity_type]
                : JOB_TYPE_LABELS[item.job.job_type]
              return (
                <Link
                  key={item.key}
                  to={`/jobs/${item.job.id}`}
                  className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border hover:bg-primary-faint transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-muted flex items-center justify-center text-primary shrink-0">
                    <Briefcase size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{item.job.profiles?.full_name ?? 'Someone'}</span>
                      {' '}posted a{' '}
                      <span className="font-medium">{typeLabel.toLowerCase()}</span>
                      {' '}opportunity
                    </p>
                    <p className="text-sm font-semibold text-ink mt-0.5 truncate">
                      {item.job.title} · {item.job.company}
                    </p>
                    <p className="text-xs text-ink-muted mt-1">
                      {formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 self-center">View →</span>
                </Link>
              )
            }

            // ── Application card (employer/mentor view) ──────────────────────
            if (item.kind === 'application') {
              const applicant = item.app.profiles as { full_name?: string } | null
              const job = item.app.jobs as { id?: string; title?: string; company?: string } | null
              return (
                <Link
                  key={item.key}
                  to={`/jobs/${job?.id}/applicants`}
                  className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border hover:bg-primary-faint transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-muted flex items-center justify-center text-primary shrink-0">
                    <UserCheck size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{applicant?.full_name ?? 'Someone'}</span>
                      {' '}applied to your opportunity
                    </p>
                    <p className="text-sm font-semibold text-ink mt-0.5 truncate">
                      {job?.title} · {job?.company}
                    </p>
                    <p className="text-xs text-ink-muted mt-1">
                      {formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 self-center">View →</span>
                </Link>
              )
            }

            // ── Message card ─────────────────────────────────────────────────
            if (item.kind === 'message') {
              return (
                <Link
                  key={item.key}
                  to={`/messages/${item.msg.conversation_id}`}
                  className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border hover:bg-primary-faint transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-muted flex items-center justify-center text-primary shrink-0">
                    <MessageSquare size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{item.msg.sender_name}</span>
                      {' '}sent you a message
                    </p>
                    <p className="text-sm text-ink-secondary mt-0.5 truncate italic">
                      "{item.msg.content}"
                    </p>
                    <p className="text-xs text-ink-muted mt-1">
                      {formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 self-center">Reply →</span>
                </Link>
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}
