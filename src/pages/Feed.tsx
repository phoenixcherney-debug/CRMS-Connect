import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Bell, RefreshCw, MessageSquare, UserCheck, BookOpen, AlertTriangle } from 'lucide-react'
import { format, formatDistanceToNow, parseISO, isPast, differenceInDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { JOB_COLUMNS } from '../lib/jobColumns'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Application, StudentPost } from '../types'
import { JOB_TYPE_LABELS, STUDENT_SEEKING_LABELS } from '../types'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'

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
  | { kind: 'student_post'; ts: string; post: StudentPost; key: string }

export default function Feed() {
  const { profile } = useAuth()
  const isStudent       = profile?.role === 'student'
  const isEmployerMentor = profile?.role === 'employer_mentor'

  const [items, setItems]         = useState<FeedItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)

  async function load(quiet = false) {
    if (!profile) return
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setLoadError(false)

    try {
    const feed: FeedItem[] = []

    // ── Community opportunities (visible to BOTH roles) ────────────────────
    // Audit feedback: an employer logging in to a fresh account expects to
    // see what's happening in the community too, not a "Nothing here yet" panel.
    {
      const { data: jobs } = await supabase
        .from('jobs')
        .select(`${JOB_COLUMNS}, profiles!jobs_posted_by_fkey(id, full_name, role)`)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(40)

      for (const j of (jobs as unknown as Job[]) ?? []) {
        if (j.deadline && isPast(parseISO(j.deadline))) continue
        // Don't show employer/mentors their own posts in their feed.
        if (isEmployerMentor && j.posted_by === profile.id) continue
        feed.push({ kind: 'job', ts: j.created_at, job: j, key: `job-${j.id}` })
      }
    }

    // ── Employer/Mentors: live student "looking for" posts ─────────────────
    // Audit M10 — feed previously only showed opportunities + applications +
    // messages. Surface student-side posts in EM feeds so mentors actually
    // see who's looking. Open posts only.
    if (isEmployerMentor) {
      const { data: posts } = await supabase
        .from('student_posts')
        .select('*, profiles!student_posts_student_id_fkey(id, full_name, avatar_url, role, grade)')
        .eq('is_closed', false)
        .order('created_at', { ascending: false })
        .limit(20)
      for (const p of (posts as StudentPost[]) ?? []) {
        feed.push({ kind: 'student_post', ts: p.created_at, post: p, key: `sp-${p.id}` })
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
          .select('*, profiles!applications_applicant_id_fkey(id, full_name, avatar_url, graduation_year, grade), jobs(id, title, company)')
          .in('job_id', myJobIds)
          .order('created_at', { ascending: false })
          .limit(40)

        for (const app of (apps as Application[]) ?? []) {
          feed.push({ kind: 'application', ts: app.created_at, app: app as Application, key: `app-${app.id}` })
        }
      }
    }

    // ── Students: their own applications + status changes (NAV-006) ──────────
    // Surface "you applied" / "you were accepted" / "you were declined" so
    // the student's feed isn't an empty community-only stream.
    if (isStudent) {
      const { data: myApps } = await supabase
        .from('applications')
        .select('*, jobs(id, title, company)')
        .eq('applicant_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)
      for (const app of (myApps as Application[]) ?? []) {
        feed.push({ kind: 'application', ts: app.created_at, app: app, key: `myapp-${app.id}` })
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
        .select('id, content, created_at, conversation_id, sender_id, profiles!messages_sender_id_fkey(full_name)')
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
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [profile?.id])

  // M-09 — strengthen the IA distinction: Activity is the community-wide
  // feed (everyone sees similar items), Notifications is "for you" only.
  const subtitle = isStudent
    ? 'What\'s happening across the community — opportunities, posts, and messages.'
    : 'What\'s happening across the community — applications to your postings, student posts, and messages.'

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Activity</h1>
          <p className="text-ink-secondary text-sm mt-0.5">{subtitle}</p>
        </div>
        <button type="button"
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
      ) : loadError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load your activity."
          description="Something went wrong. Please try again."
          ctaLabel="Retry"
          ctaOnClick={() => load()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing here yet."
          description="Activity will appear as the community grows."
        />
      ) : (
        // L-12 — group items by Today / This week / Older for parity with /notifications.
        (() => {
          const todayItems: typeof items = []
          const weekItems: typeof items = []
          const olderItems: typeof items = []
          const now = new Date()
          for (const it of items) {
            const days = differenceInDays(now, parseISO(it.ts))
            if (days <= 0) todayItems.push(it)
            else if (days <= 7) weekItems.push(it)
            else olderItems.push(it)
          }
          const sections = [
            { label: 'Today',     items: todayItems },
            { label: 'This week', items: weekItems  },
            { label: 'Older',     items: olderItems },
          ].filter((s) => s.items.length > 0)
          return (
            <div className="space-y-6">
              {sections.map(({ label, items: sectionItems }) => (
                <section key={label}>
                  <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2">{label}</h2>
                  <div className="space-y-2">
                    {sectionItems.map((item) => renderItem(item))}
                  </div>
                </section>
              ))}
            </div>
          )

          function renderItem(item: typeof items[number]) {
            // ── Job opportunity card ─────────────────────────────────────────
            if (item.kind === 'job') {
              // Always source the human-readable category from job_type so
              // every row reads as "{name} posted a {category} opportunity".
              // The legacy opportunity_type produced awkward copy like
              // "posted a job / internship opportunity" (audit §14).
              const typeLabel = JOB_TYPE_LABELS[item.job.job_type]
              const article = /^[aeiou]/i.test(typeLabel) ? 'an' : 'a'
              return (
                <Link
                  key={item.key}
                  to={`/opportunities/${item.job.id}`}
                  className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border hover:bg-primary-faint transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-muted flex items-center justify-center text-primary shrink-0">
                    <Briefcase size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{item.job.profiles?.full_name ?? 'Someone'}</span>
                      {' '}posted {article}{' '}
                      <span className="font-medium">{typeLabel.toLowerCase()}</span>
                      {' '}opportunity
                    </p>
                    <p className="text-sm font-semibold text-ink mt-0.5 truncate">
                      {item.job.title} · {item.job.company}
                    </p>
                    <p className="text-xs text-ink-muted mt-1"><time dateTime={item.ts} title={format(parseISO(item.ts), "MMM d, yyyy at h:mm a")}>{formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}</time></p>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 self-center">View →</span>
                </Link>
              )
            }

            // ── Application card (NAV-006 — student sees self-actions too) ─────
            if (item.kind === 'application') {
              const applicant = item.app.profiles as { full_name?: string } | null
              const job = item.app.jobs as { id?: string; title?: string; company?: string } | null
              const isOwnApp = isStudent && item.app.applicant_id === profile?.id
              const link = isOwnApp ? '/applications' : `/opportunities/${job?.id}/applicants`
              const verb =
                isOwnApp && item.app.status === 'accepted'  ? 'were accepted for'  :
                isOwnApp && item.app.status === 'rejected'  ? 'were not selected for' :
                isOwnApp                                    ? 'applied to'        :
                /* employer view */                           'applied to your opportunity'
              return (
                <Link
                  key={item.key}
                  to={link}
                  className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border hover:bg-primary-faint transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-muted flex items-center justify-center text-primary shrink-0">
                    <UserCheck size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{isOwnApp ? 'You' : (applicant?.full_name ?? 'Someone')}</span>
                      {' '}{isOwnApp ? verb + ' ' : verb}
                      {isOwnApp && job?.title && <span className="font-medium">{job.title}</span>}
                    </p>
                    <p className="text-sm font-semibold text-ink mt-0.5 truncate">
                      {job?.title} · {job?.company}
                    </p>
                    <p className="text-xs text-ink-muted mt-1"><time dateTime={item.ts} title={format(parseISO(item.ts), "MMM d, yyyy at h:mm a")}>{formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}</time></p>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 self-center">View →</span>
                </Link>
              )
            }

            // ── Student "looking for" post ───────────────────────────────────
            if (item.kind === 'student_post') {
              const author = item.post.profiles as { id?: string; full_name?: string } | null
              const seekingLabel =
                item.post.seeking === 'other'
                  ? (item.post.seeking_other ?? 'something else')
                  : STUDENT_SEEKING_LABELS[item.post.seeking].toLowerCase()
              return (
                <Link
                  key={item.key}
                  to={author?.id ? `/people/${author.id}` : '/student-posts'}
                  className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border hover:bg-primary-faint transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary-muted flex items-center justify-center text-primary shrink-0">
                    <BookOpen size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{author?.full_name ?? 'A student'}</span>
                      {' '}posted that they're looking for{' '}
                      <span className="font-medium">{seekingLabel}</span>
                    </p>
                    <p className="text-sm text-ink-secondary mt-0.5 line-clamp-2 italic">
                      "{item.post.pitch}"
                    </p>
                    <p className="text-xs text-ink-muted mt-1"><time dateTime={item.ts} title={format(parseISO(item.ts), "MMM d, yyyy at h:mm a")}>{formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}</time></p>
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
                    <p className="text-xs text-ink-muted mt-1"><time dateTime={item.ts} title={format(parseISO(item.ts), "MMM d, yyyy at h:mm a")}>{formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}</time></p>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0 self-center">Reply →</span>
                </Link>
              )
            }

            return null
          }
        })()
      )}
    </div>
  )
}
