/**
 * P2-20 — single render-side normalizer for display names. The stored
 * value is whatever the user typed; this helper makes sure the UI
 * surfaces the same casing everywhere.
 *
 * Rule: if the name has any uppercase letter (i.e. the user clearly
 * picked a casing) leave it alone — preserves "O'Brien", "Mary-Anne",
 * "iOS Joe", "DJ Smith". Otherwise (all lowercase or empty) title-case
 * each whitespace-delimited token. Hyphenated tokens get title-cased
 * per piece ("mary-anne" → "Mary-Anne").
 */
export function formatDisplayName(raw: string | null | undefined): string {
  const name = (raw ?? '').trim()
  if (!name) return ''
  if (/[A-Z]/.test(name)) return name
  return name
    .split(/\s+/)
    .map((tok) =>
      tok
        .split('-')
        .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
        .join('-'),
    )
    .join(' ')
}
