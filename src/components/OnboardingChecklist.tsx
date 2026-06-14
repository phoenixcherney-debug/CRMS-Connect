import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ChevronUp } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const MIN_KEY = 'crms.onboarding_checklist.minimized'

interface ItemSpec {
  key: string
  label: string
  cta: string
  to: string
  isComplete: (ctx: ChecklistCtx) => boolean
}

interface ChecklistCtx {
  hasAvatar: boolean
  bioWordCount: number
  hasIndustry: boolean
  hasAvailability: boolean
  hasGradYear: boolean
  isOpen: boolean
  hasJobOrCareer: boolean
}

/**
 * P1-3 — six-row checklist on /explore for new E/M accounts. Each row
 * lights up green when complete; the whole strip auto-disappears at 6/6
 * and re-shows whenever a row regresses (e.g. user removes their avatar).
 *
 * Persistence: only the "minimized" UI state is in localStorage. Actual
 * completion state is derived from the profile + a single career_history
 * + jobs count query, so a new browser / device shows the right state.
 */
export default function OnboardingChecklist() {
  const { profile } = useAuth()
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return localStorage.getItem(MIN_KEY) === '1' } catch { return false }
  })
  const [hasJobOrCareer, setHasJobOrCareer] = useState<boolean | null>(null)

  // One round-trip to figure out the "career or job" item.
  useEffect(() => {
    if (!profile || profile.role !== 'employer_mentor') {
      setHasJobOrCareer(null)
      return
    }
    let cancelled = false
    async function check() {
      if (!profile) return
      const [{ count: jobCount }, { count: careerCount }] = await Promise.all([
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('posted_by', profile.id),
        supabase.from('career_history').select('*', { count: 'exact', head: true }).eq('profile_id', profile.id),
      ])
      if (!cancelled) setHasJobOrCareer((jobCount ?? 0) + (careerCount ?? 0) > 0)
    }
    check()
    return () => { cancelled = true }
  }, [profile?.id, profile?.role])

  const ctx = useMemo<ChecklistCtx | null>(() => {
    if (!profile || profile.role !== 'employer_mentor') return null
    if (hasJobOrCareer === null) return null
    return {
      hasAvatar: !!profile.avatar_url,
      bioWordCount: (profile.bio ?? '').trim().split(/\s+/).filter(Boolean).length,
      hasIndustry: !!profile.industry,
      hasAvailability: !!profile.weekly_availability,
      hasGradYear: !!profile.graduation_year,
      isOpen: !!profile.open_to_mentorship,
      hasJobOrCareer,
    }
  }, [profile, hasJobOrCareer])

  const items: ItemSpec[] = [
    { key: 'avatar',       label: 'Add a profile photo',                      cta: 'Add photo',      to: '/profile/edit', isComplete: (c) => c.hasAvatar },
    { key: 'bio',          label: 'Write a two-sentence bio',                 cta: 'Write bio',      to: '/profile/edit', isComplete: (c) => c.bioWordCount >= 12 },
    { key: 'industry',     label: 'Add your industry & weekly availability', cta: 'Edit profile',   to: '/profile/edit', isComplete: (c) => c.hasIndustry && c.hasAvailability },
    { key: 'gradYear',     label: 'Add your graduation year (alumni only)',   cta: 'Edit profile',   to: '/profile/edit', isComplete: (c) => c.hasGradYear },
    { key: 'mentorMode',   label: 'Confirm "Open to mentorship" is on',       cta: 'Open profile',   to: '/profile/edit', isComplete: (c) => c.isOpen },
    { key: 'jobOrCareer',  label: 'Post your first opportunity or add a position', cta: 'Get started', to: '/opportunities/new', isComplete: (c) => c.hasJobOrCareer },
  ]

  if (!ctx) return null
  const completed = items.filter((i) => i.isComplete(ctx)).length
  if (completed >= items.length) return null  // auto-hide at 6/6.

  function toggleMin(next: boolean) {
    setMinimized(next)
    try { localStorage.setItem(MIN_KEY, next ? '1' : '0') } catch { /* ignore */ }
  }

  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => toggleMin(false)}
        className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary-muted bg-primary-faint text-xs font-medium text-primary hover:bg-primary-muted transition-colors"
      >
        <CheckCircle2 size={13} />
        Resume onboarding · {completed}/{items.length}
      </button>
    )
  }

  return (
    <div
      className="mb-6 rounded-xl border border-primary-muted bg-primary-faint p-4"
      role="region"
      aria-label="Onboarding checklist"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-ink">Get set up · {completed}/{items.length}</p>
          <p className="text-xs text-ink-muted mt-0.5">
            Six steps to be useful to students. Knock them out in any order.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => toggleMin(true)}
            aria-label="Minimize"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-muted hover:bg-primary-muted"
          >
            <ChevronUp size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-primary-muted rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(completed / items.length) * 100}%` }}
        />
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => {
          const done = item.isComplete(ctx)
          return (
            <li key={item.key} className="flex items-center gap-3 text-sm">
              {done ? (
                <CheckCircle2 size={15} className="text-success shrink-0" />
              ) : (
                <span className="w-[15px] h-[15px] rounded-full border-2 border-border bg-surface shrink-0" />
              )}
              <span className={`flex-1 ${done ? 'text-ink-muted line-through' : 'text-ink'}`}>
                {item.label}
              </span>
              {!done && (
                <Link
                  to={item.to}
                  className="text-xs font-medium text-primary hover:text-primary-light underline shrink-0"
                >
                  {item.cta} →
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

