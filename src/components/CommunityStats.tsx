import { useEffect, useState } from 'react'
import { Users, Briefcase, Heart } from 'lucide-react'
import { getCommunityStats, type CommunityStats as Stats } from '../lib/stats'

/**
 * Phase 4.4 / Task 5 — community-stat strip rendered on public pages
 * (Landing, /for-mentors, /for-employers, /about). Reads from the one
 * shared getCommunityStats() helper so the numbers can't drift from
 * other surfaces that show counts.
 */
export default function CommunityStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next = await getCommunityStats()
      if (!cancelled) setStats(next)
    })()
    return () => { cancelled = true }
  }, [])

  if (!stats) return null

  const items: { value: number; label: string; icon: React.ReactNode }[] = [
    { value: stats.mentors,             label: 'Mentors available', icon: <Heart size={14} /> },
    { value: stats.students,            label: 'Students',          icon: <Users size={14} /> },
    { value: stats.opportunitiesActive, label: 'Opportunities open', icon: <Briefcase size={14} /> },
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
