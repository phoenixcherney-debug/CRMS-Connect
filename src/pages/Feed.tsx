import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Bell, RefreshCw } from 'lucide-react'
import { formatDistanceToNow, parseISO, isPast } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Profile } from '../types'
import { JOB_TYPE_LABELS, ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

type FeedItem =
  | { kind: 'job';         ts: string; job:    Job;         key: string }
  | { kind: 'member';      ts: string; person: Profile;     key: string }

export default function Feed() {
  const { profile } = useAuth()
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(quiet = false) {
    if (!profile) return
    if (quiet) setRefreshing(true)
    else setLoading(true)

    const [{ data: jobs }, { data: people }] = await Promise.all([
      supabase
        .from('jobs')
        .select('*, profiles(id, full_name, role)')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('profiles')
        .select('id, full_name, role, graduation_year, avatar_url, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const feed: FeedItem[] = []

    // Job postings (skip closed/expired)
    for (const j of (jobs as Job[]) ?? []) {
      if (!j.is_active) continue
      if (j.deadline && isPast(parseISO(j.deadline))) continue
      feed.push({ kind: 'job', ts: j.created_at, job: j, key: `job-${j.id}` })
    }

    // New members (exclude self)
    for (const p of (people as Profile[]) ?? []) {
      if (p.id === profile.id) continue
      feed.push({ kind: 'member', ts: p.created_at, person: p, key: `member-${p.id}` })
    }

    feed.sort((a, b) => b.ts.localeCompare(a.ts))
    setItems(feed.slice(0, 60))
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [profile?.id])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Feed</h1>
          <p className="text-ink-secondary text-sm mt-0.5">New jobs and members in the community</p>
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
            if (item.kind === 'job') {
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
                      <span className="font-medium">{JOB_TYPE_LABELS[item.job.job_type].toLowerCase()}</span>
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

            if (item.kind === 'member') {
              const p = item.person
              const initials = p.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <div
                  key={item.key}
                  className="flex items-start gap-4 p-4 bg-surface rounded-xl border border-border"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-9 h-9 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={p.full_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{p.full_name}</span>
                      {' '}joined as a{' '}
                      <span className="capitalize font-medium">{ROLE_LABELS[p.role]}</span>
                    </p>
                    {p.graduation_year && (
                      <p className="text-xs text-ink-secondary mt-0.5">Class of {p.graduation_year}</p>
                    )}
                    <p className="text-xs text-ink-muted mt-1">
                      {formatDistanceToNow(parseISO(item.ts), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}
