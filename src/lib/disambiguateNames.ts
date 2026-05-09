// F.2 — render-time name disambiguation. When a list of users contains
// the same display name twice, append a small suffix (cohort, grade, or
// join month) to the duplicates so messaging UX doesn't confuse them.
//
// Suffix is computed on the fly; nothing is stored. Pass the list through
// before mapping to JSX, then read `_nameSuffix` on each row.
//
// Inputs are loose on purpose so this can be reused across People,
// Messages, Employers, etc. without dragging in shared types.

import { format, parseISO } from 'date-fns'

export interface DisambiguableUser {
  id: string
  full_name?: string | null
  graduation_year?: number | null
  grade?: string | null
  share_grade_with_employers?: boolean | null
  created_at?: string | null
}

export interface DisambiguatedUser<T extends DisambiguableUser> {
  user: T
  /** Empty string when no collision; otherwise something like "Class of 2027". */
  nameSuffix: string
}

function suffixFor(u: DisambiguableUser): string {
  // Only surface grade/year if the student opted in. Otherwise we'd leak
  // the cohort just to disambiguate. Falls back to join month.
  if (u.share_grade_with_employers && u.grade) return u.grade
  if (u.share_grade_with_employers && u.graduation_year) return `Class of ${u.graduation_year}`
  if (u.created_at) {
    try { return `joined ${format(parseISO(u.created_at), 'MMM yyyy')}` }
    catch { /* ignore */ }
  }
  return ''
}

export function disambiguateNames<T extends DisambiguableUser>(users: T[]): DisambiguatedUser<T>[] {
  const counts = new Map<string, number>()
  for (const u of users) {
    const key = (u.full_name ?? '').trim().toLowerCase()
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return users.map((u) => {
    const key = (u.full_name ?? '').trim().toLowerCase()
    const collides = !!key && (counts.get(key) ?? 0) > 1
    return { user: u, nameSuffix: collides ? suffixFor(u) : '' }
  })
}
