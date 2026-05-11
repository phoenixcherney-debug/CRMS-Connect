import { supabase } from './supabase'

/**
 * Task 5 — single source of truth for headcounts. Every page that
 * displays a "X members / Y students / Z companies" must call this
 * helper instead of doing its own count query, so the numbers can't
 * drift between Explore, /students, /about, /for-employers, /for-mentors.
 *
 * Mirrors the SQL function `public.community_stats()` defined in
 * migration 076. Keep these definitions in sync:
 *   • members              — all non-deleted, non-admin profiles
 *   • students             — role=student with ≥1 interest selected
 *                            (= "profile completed" rough proxy)
 *   • mentors              — role=employer_mentor and
 *                            open_to_mentorship=true
 *   • companies            — distinct trimmed non-blank `company`
 *                            across active non-draft jobs
 *   • opportunitiesActive  — active non-draft jobs whose deadline is
 *                            null or in the future
 */
export interface CommunityStats {
  members: number
  students: number
  mentors: number
  companies: number
  opportunitiesActive: number
}

const ZERO: CommunityStats = {
  members: 0,
  students: 0,
  mentors: 0,
  companies: 0,
  opportunitiesActive: 0,
}

export async function getCommunityStats(): Promise<CommunityStats> {
  const { data, error } = await supabase.rpc('community_stats')
  if (error || !data) return ZERO
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return ZERO
  return {
    members:              Number(row.members ?? 0),
    students:             Number(row.students ?? 0),
    mentors:              Number(row.mentors ?? 0),
    companies:            Number(row.companies ?? 0),
    opportunitiesActive:  Number(row.opportunities_active ?? 0),
  }
}
