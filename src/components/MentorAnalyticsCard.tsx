import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Users, Eye, Calendar, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Phase 4.1 — light analytics card for employer/mentor accounts on
 * /explore. Pulls four cheap counts in parallel:
 *   • active opportunities
 *   • new applications in the past 7 days (on their postings)
 *   • opportunity views in the past 7 days (on their postings)
 *   • pending meeting requests
 *
 * Hidden when every number is zero so a brand-new mentor doesn't see
 * a board of zeros on day one.
 */
interface Stats {
  activePosts: number
  newApps: number
  newViews: number
  pendingMeetings: number
}

export default function MentorAnalyticsCard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile?.role !== 'employer_mentor') { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: postings } = await supabase
        .from('jobs')
        .select('id')
        .eq('posted_by', profile.id)
        .eq('is_active', true)
      const postIds = (postings ?? []).map((p) => p.id)
      const activePosts = postIds.length

      // Run counts in parallel. Use head:true to skip data transfer.
      const [appsRes, viewsRes, meetingsRes] = await Promise.all([
        postIds.length > 0
          ? supabase
              .from('applications')
              .select('*', { count: 'exact', head: true })
              .gte('created_at', sevenDaysAgo)
              .in('job_id', postIds)
          : Promise.resolve({ count: 0 }),
        postIds.length > 0
          ? supabase
              .from('opportunity_views')
              .select('*', { count: 'exact', head: true })
              .gte('created_at', sevenDaysAgo)
              .in('job_id', postIds)
          : Promise.resolve({ count: 0 }),
        supabase
          .from('meeting_requests')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', profile.id)
          .eq('status', 'pending'),
      ])
      if (cancelled) return
      setStats({
        activePosts,
        newApps:        appsRes.count ?? 0,
        newViews:       viewsRes.count ?? 0,
        pendingMeetings: meetingsRes.count ?? 0,
      })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [profile?.id, profile?.role])

  if (loading || !stats) return null
  const total = stats.activePosts + stats.newApps + stats.newViews + stats.pendingMeetings
  if (total === 0) return null

  return (
    <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-ink">Your week at a glance</p>
        <span className="text-[11px] text-ink-muted">Last 7 days</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile
          icon={<Briefcase size={14} />}
          value={stats.activePosts}
          label="Active posts"
          to="/my-opportunities"
        />
        <Tile
          icon={<Users size={14} />}
          value={stats.newApps}
          label="New apps"
          to="/my-opportunities"
        />
        <Tile
          icon={<Eye size={14} />}
          value={stats.newViews}
          label="Post views"
          to="/my-opportunities"
        />
        <Tile
          icon={<Calendar size={14} />}
          value={stats.pendingMeetings}
          label="Meeting reqs"
          to="/meetings"
        />
      </div>
    </div>
  )
}

function Tile({
  icon, value, label, to,
}: {
  icon: React.ReactNode
  value: number
  label: string
  to: string
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border bg-primary-faint p-3 hover:bg-primary-muted transition-colors"
    >
      <div className="flex items-center gap-1.5 text-primary mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
        <ChevronRight size={11} className="ml-auto opacity-60 group-hover:opacity-100" />
      </div>
      <p className="text-xl font-bold text-ink leading-none">{value}</p>
    </Link>
  )
}
