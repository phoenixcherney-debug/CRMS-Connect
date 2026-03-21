import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, UserPlus, Building2, MapPin, ChevronLeft, Pin } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job, Profile } from '../types'
import { JOB_TYPE_LABELS, ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

interface FeedItem {
  id: string
  type: 'job' | 'member'
  timestamp: string
  job?: Job
  profile?: Profile
}

export default function Feed() {
  const { profile } = useAuth()
  const [items, setItems] = useState<FeedItem[]>([])
  const [pinnedJobs, setPinnedJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: jobs }, { data: profiles }] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, profiles(id, full_name, role)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('profiles')
          .select('*')
          .eq('onboarding_complete', true)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const feed: FeedItem[] = []

      for (const job of (jobs as Job[]) ?? []) {
        feed.push({
          id: `job-${job.id}`,
          type: 'job',
          timestamp: job.created_at,
          job,
        })
      }

      for (const p of (profiles as Profile[]) ?? []) {
        feed.push({
          id: `member-${p.id}`,
          type: 'member',
          timestamp: p.created_at,
          profile: p,
        })
      }

      feed.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      setItems(feed.slice(0, 30))

      // Load pinned jobs for current user
      if (profile) {
        const { data: pins } = await supabase
          .from('pinned_jobs')
          .select('job_id, jobs(*, profiles(id, full_name, role))')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
        const pinned = (pins ?? [])
          .map((p: { job_id: string; jobs: Job | null }) => p.jobs)
          .filter(Boolean) as Job[]
        setPinnedJobs(pinned)
      }

      setLoading(false)
    }
    load()
  }, [profile?.id])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-ink-secondary hover:text-ink mb-3">
          <ChevronLeft size={16} /> Explore
        </Link>
        <h1 className="text-2xl font-bold text-ink">Feed</h1>
        <p className="text-ink-secondary text-sm mt-0.5">Recent activity in the CRMS community</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <p className="text-ink-muted">No activity yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pinned jobs section */}
          {pinnedJobs.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2 px-1">
                <Pin size={12} />
                Pinned
              </div>
              <div className="space-y-2">
                {pinnedJobs.map((job) => (
                  <Link
                    key={`pinned-${job.id}`}
                    to={`/jobs/${job.id}`}
                    className="flex gap-4 bg-surface rounded-xl border border-primary/30 p-4 hover:shadow-md transition-shadow"
                    style={{ boxShadow: 'var(--shadow-card)' }}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary-muted flex items-center justify-center shrink-0">
                      <Pin size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink">{job.title}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-ink-muted">
                        <span className="flex items-center gap-1">
                          <Building2 size={11} /> {job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {job.location}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-primary-faint text-primary font-medium">
                          {JOB_TYPE_LABELS[job.job_type]}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="border-t border-border mt-4 mb-1" />
            </div>
          )}

          {items.map((item) => {
            if (item.type === 'job' && item.job) {
              const job = item.job
              return (
                <Link
                  key={item.id}
                  to={`/jobs/${job.id}`}
                  className="flex gap-4 bg-surface rounded-xl border border-border p-4 hover:shadow-md transition-shadow"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-muted flex items-center justify-center shrink-0">
                    <Briefcase size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-secondary">
                      <span className="font-medium text-ink">{job.profiles?.full_name ?? 'Someone'}</span>
                      {' '}posted a new opportunity
                    </p>
                    <h3 className="font-semibold text-ink mt-1">{job.title}</h3>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-ink-muted">
                      <span className="flex items-center gap-1">
                        <Building2 size={11} /> {job.company}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {job.location}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-primary-faint text-primary font-medium">
                        {JOB_TYPE_LABELS[job.job_type]}
                      </span>
                    </div>
                    <p className="text-xs text-ink-muted mt-2">
                      {formatDistanceToNow(parseISO(job.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
              )
            }

            if (item.type === 'member' && item.profile) {
              const p = item.profile
              const initials = p.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
              return (
                <div
                  key={item.id}
                  className="flex gap-4 bg-surface rounded-xl border border-border p-4"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <UserPlus size={18} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-secondary">
                      New member joined the community
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="w-8 h-8 rounded-full bg-primary-muted flex items-center justify-center text-primary text-xs font-bold">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{p.full_name}</p>
                        <p className="text-xs text-ink-muted">
                          {ROLE_LABELS[p.role]}
                          {p.graduation_year ? ` · Class of ${p.graduation_year}` : ''}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-ink-muted mt-2">
                      {formatDistanceToNow(parseISO(p.created_at), { addSuffix: true })}
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
