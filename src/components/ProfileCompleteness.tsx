import { Link } from 'react-router-dom'
import type { Profile } from '../types'

/**
 * Phase 2.2 — completeness % gauge for student profiles. Shown on
 * /explore (as a card) and /profile/edit (as an inline summary). The
 * checklist also tells the student which field would move the needle
 * most so they don't have to hunt.
 *
 * Each weighted check counts equally; the % is just (filled / total).
 */
interface Check {
  key: string
  label: string
  done: boolean
  /** Task 19 — hash fragment on /profile/edit that scrolls + focuses
   *  the matching field when this row is clicked. */
  hash: string
}

function buildChecks(profile: Profile): Check[] {
  const skills = profile.skills ?? []
  const projects = profile.projects ?? []
  const links = profile.links ?? {}
  // Task 14 — student-side checklist no longer asks for a photo.
  // Photos are required for mentors (gated where they toggle mentor
  // mode on), not for students.
  return [
    { key: 'bio',       label: 'Write a short bio',            done: !!profile.bio && profile.bio.trim().length >= 30, hash: 'bio' },
    { key: 'grade',     label: 'Pick your grade',              done: !!profile.grade, hash: 'grade' },
    { key: 'gradyear',  label: 'Set your graduation year',     done: !!profile.graduation_year, hash: 'graduation_year' },
    { key: 'seeking',   label: 'Say what you are looking for', done: !!profile.student_seeking, hash: 'student_seeking' },
    { key: 'hours',     label: 'Set weekly availability',      done: !!profile.weekly_availability, hash: 'weekly_availability' },
    { key: 'interests', label: 'Pick areas of interest',       done: (profile.interests?.length ?? 0) >= 1, hash: 'interests' },
    { key: 'skills',    label: 'Add 3+ skills',                done: skills.length >= 3, hash: 'skills' },
    { key: 'projects',  label: 'Add a project',                done: projects.length >= 1, hash: 'projects' },
    { key: 'links',     label: 'Add a link (GitHub / site / LinkedIn)', done: Object.values(links).some((v) => !!v), hash: 'links' },
    { key: 'resume',    label: 'Upload a default resume',      done: !!profile.default_resume_path, hash: 'default_resume' },
  ]
}

export function profileCompletenessPct(profile: Profile): number {
  const checks = buildChecks(profile)
  const done = checks.filter((c) => c.done).length
  return Math.round((done / checks.length) * 100)
}

interface Props {
  profile: Profile
  /** "card" renders the bigger /explore card; "inline" is for /profile/edit. */
  variant?: 'card' | 'inline'
}

export default function ProfileCompleteness({ profile, variant = 'card' }: Props) {
  if (profile.role !== 'student') return null
  const checks = buildChecks(profile)
  const pct = profileCompletenessPct(profile)
  const nextUp = checks.find((c) => !c.done)
  if (pct === 100) return null

  if (variant === 'inline') {
    return (
      <div className="rounded-lg border border-border bg-primary-faint px-3 py-2 text-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative h-2 bg-border rounded-full flex-1 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-ink shrink-0">{pct}%</span>
        </div>
        {nextUp && (
          <span className="text-xs text-ink-muted whitespace-nowrap hidden sm:inline">
            Next: {nextUp.label}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-ink">Your profile is {pct}% complete</p>
        <Link to="/profile/edit" className="text-xs font-medium text-primary hover:text-primary-light">
          Edit profile →
        </Link>
      </div>
      <div className="relative h-2 bg-border rounded-full overflow-hidden mb-3">
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-ink-muted mb-2">
        A more complete profile gets more mentor responses and stronger application reviews.
      </p>
      <ul className="space-y-1 text-xs">
        {checks.map((c) => (
          <li key={c.key}>
            {c.done ? (
              <span className="text-ink-muted line-through">
                <span className="inline-block w-3 text-success">✓</span> {c.label}
              </span>
            ) : (
              <Link
                to={`/profile/edit#${c.hash}`}
                className="text-ink-secondary hover:text-primary transition-colors"
              >
                <span className="inline-block w-3 text-ink-muted">○</span> {c.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
