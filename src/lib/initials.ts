// L-02 — single source of truth for "first + last initial".
//
// Previously every site computed initials by mapping the first letter of
// every space-separated token, which produced "Claude QA Student" → "CQ"
// instead of the expected "CS". This helper takes the first and the
// LAST token's leading letters so multi-word middle bits stop hijacking
// the second slot.
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return '?'
  if (tokens.length === 1) return tokens[0][0]!.toUpperCase()
  const first = tokens[0][0] ?? ''
  const last  = tokens[tokens.length - 1][0] ?? ''
  return (first + last).toUpperCase()
}
