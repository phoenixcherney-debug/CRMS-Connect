import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { initialsOf } from '../lib/initials'
import { MENTOR_TYPE_LABELS, type MentorType } from '../types'

/**
 * Phase 4.3 — public Mentor Wall. Sourced via the SECURITY DEFINER
 * `list_mentor_wall()` RPC so anonymous visitors can see the opt-in
 * mentors without us widening profiles RLS. Email / bio never leave
 * the safe column set.
 */
interface WallEntry {
  id: string
  full_name: string
  avatar_url: string | null
  company: string | null
  industry: string | null
  mentor_type: MentorType | null
  mentor_type_other: string | null
}

export default function MentorWall() {
  const [entries, setEntries] = useState<WallEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.rpc('list_mentor_wall')
      if (!cancelled) {
        setEntries((data ?? []) as WallEntry[])
        setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!loaded || entries.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-ink mb-1">Mentors in the community</h2>
      <p className="text-xs text-ink-muted mb-3">
        A few of the alumni and partners currently mentoring CRMS students.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {entries.map((m) => {
          const initials = initialsOf(m.full_name)
          const typeLabel =
            m.mentor_type === 'other'
              ? (m.mentor_type_other || 'Mentor')
              : m.mentor_type
                ? MENTOR_TYPE_LABELS[m.mentor_type]
                : 'Mentor'
          return (
            <div
              key={m.id}
              className="bg-surface rounded-xl border border-border p-3 flex items-start gap-3"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="w-10 h-10 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{m.full_name}</p>
                <p className="text-[11px] text-ink-muted truncate">{typeLabel}</p>
                {(m.company || m.industry) && (
                  <p className="text-[11px] text-ink-secondary truncate">
                    {[m.company, m.industry].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
