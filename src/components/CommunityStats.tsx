import { useEffect, useState } from 'react'
import { Users, Briefcase, Heart } from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * Phase 4.4 — community-stat strip rendered on public pages
 * (Landing, /for-mentors, /for-employers, /about). Calls
 * community_stats() — a SECURITY DEFINER RPC that only returns
 * three counts. Hidden until the data loads to avoid flash of
 * skeletons on slow connections.
 */
interface Stats {
  active_mentors: number
  active_students: number
  active_opportunities: number
}

export default function CommunityStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.rpc('community_stats')
      if (!cancelled) {
        const row = Array.isArray(data) ? data[0] : data
        if (row) setStats(row as Stats)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!stats) return null

  const items: { value: number; label: string; icon: React.ReactNode }[] = [
    { value: stats.active_mentors,       label: 'Mentors available', icon: <Heart size={14} /> },
    { value: stats.active_students,      label: 'Students',          icon: <Users size={14} /> },
    { value: stats.active_opportunities, label: 'Opportunities open', icon: <Briefcase size={14} /> },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="bg-surface rounded-xl border border-border p-3 text-center"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center justify-center gap-1 text-primary mb-1">
            {it.icon}
            <span className="text-[11px] font-medium uppercase tracking-wider">{it.label}</span>
          </div>
          <p className="text-2xl font-bold text-ink leading-none">{it.value}</p>
        </div>
      ))}
    </div>
  )
}
