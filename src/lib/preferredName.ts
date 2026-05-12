// Task 24 — single source of truth for "what should we call this user."
//
// Resolution order:
//   1. preferred_name (trimmed, stray surrounding quotes stripped)
//   2. first whitespace-delimited token of full_name (same cleaning)
//   3. full_name verbatim
//
// Casing is preserved — "Mary", "sam", "O'Brien" all render as typed.

function cleanToken(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '') // strip stray surrounding quotes
    .trim()
}

interface NameSource {
  full_name?: string | null
  preferred_name?: string | null
}

/** First-name token for greetings and short labels. */
export function firstNameOf(p: NameSource | null | undefined): string {
  if (!p) return ''
  const pref = cleanToken(p.preferred_name ?? '')
  if (pref) return pref
  const full = cleanToken(p.full_name ?? '')
  if (!full) return ''
  return cleanToken(full.split(/\s+/)[0] ?? '')
}

/** Display name. Currently == full_name (cleaned) since the spec keeps
 *  full_name as the canonical formal name. Provided so future renames
 *  centralise here. */
export function displayNameOf(p: NameSource | null | undefined): string {
  if (!p) return ''
  return cleanToken(p.full_name ?? '')
}
