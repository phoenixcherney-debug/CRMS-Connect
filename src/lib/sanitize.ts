// Free-text sanitization. Mirrors the server-side trigger in
// supabase/migrations/032_sanitize_user_text.sql so the UI can refuse
// dangerous payloads before round-tripping to the DB.
//
// Strategy:
//  1. Strip every <…>-shaped substring (no HTML allowed in this app's
//     user content today). React already escapes for render, but raw
//     payloads in the DB still leak through copy-paste, exports, and
//     anywhere we eventually want to surface plain text.
//  2. Reject obvious SQL-injection markers (`-- ;DROP …`, `;DELETE`,
//     `UNION SELECT`). These shouldn't be present in legitimate prose.

const TAG_RE = /<[^>]*>/g
// Matches: a `--` SQL comment immediately followed by what looks like a
// statement, or any of the destructive verbs preceded by a `;`. Case-
// insensitive. Whitespace tolerant.
const SQLI_RE = /(--\s*\b(?:drop|delete|update|alter|truncate|insert)\b|;\s*\b(?:drop|delete|truncate)\b\s+\w|union\s+select)/i

export interface SanitizeResult {
  /** Cleaned text safe to persist. */
  clean: string
  /** True if the caller should reject the input outright (SQLi marker). */
  rejected: boolean
  /** User-readable message when rejected. */
  reason: string | null
}

export function sanitizeUserText(raw: string | null | undefined): SanitizeResult {
  const input = (raw ?? '').toString()
  if (!input) return { clean: '', rejected: false, reason: null }

  if (SQLI_RE.test(input)) {
    return {
      clean: '',
      rejected: true,
      reason: 'That text contains characters we don\'t allow.',
    }
  }

  const clean = input.replace(TAG_RE, '')
  return { clean, rejected: false, reason: null }
}

/** Convenience: returns the clean string when safe, throws otherwise. */
export function sanitizeOrThrow(raw: string | null | undefined): string {
  const r = sanitizeUserText(raw)
  if (r.rejected) throw new Error(r.reason ?? 'Invalid input')
  return r.clean
}
