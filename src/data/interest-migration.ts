// Task 12 — old INTEREST_OPTIONS → new 8-bucket taxonomy. Mirror of
// migration 077_interest_taxonomy.sql; keep both in sync.

export const INTEREST_MIGRATION: Record<string, string> = {
  'Technology':                     'Technology & Engineering',
  'Engineering':                    'Technology & Engineering',
  'Architecture & Design':          'Technology & Engineering',
  'Finance & Banking':              'Finance, Business & Government',
  'Consulting':                     'Finance, Business & Government',
  'Real Estate':                    'Finance, Business & Government',
  'Government & Public Policy':     'Finance, Business & Government',
  'Law & Legal':                    'Finance, Business & Government',
  'Healthcare & Medicine':          'Healthcare & Science',
  'Science & Research':             'Healthcare & Science',
  'Arts & Entertainment':           'Arts, Media & Communications',
  'Marketing & Communications':     'Arts, Media & Communications',
  'Environmental & Sustainability': 'Environment, Agriculture & Outdoors',
  'Agriculture & Ranching':         'Environment, Agriculture & Outdoors',
  'Education':                      'Education & Social Impact',
  'Non-Profit & Social Impact':     'Education & Social Impact',
  'Hospitality & Tourism':          'Hospitality, Sports & Recreation',
  'Sports & Recreation':            'Hospitality, Sports & Recreation',
  'Other':                          'Other',
}

/** Map an array of old-taxonomy interests to the new buckets,
 *  deduplicated. Unknown values fall through unchanged. */
export function migrateInterests(input: string[] | null | undefined): string[] {
  if (!input || input.length === 0) return []
  const out = new Set<string>()
  for (const raw of input) {
    out.add(INTEREST_MIGRATION[raw] ?? raw)
  }
  return [...out]
}
