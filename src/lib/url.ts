// External-link safety. Use at submit time on user-provided URLs and at
// render time before piping a stored URL into an `<a href>`.
//
// Allowlist-based: we only let `http:` and `https:` through. Everything
// else (`javascript:`, `data:`, `vbscript:`, `file:`, …) is rejected so
// a malicious resume link can't run script in a viewer's session.

export interface UrlValidation {
  /** Sanitized URL safe for `<a href>`, or null if rejected. */
  safe: string | null
  /** User-readable rejection reason if not safe. */
  reason: string | null
}

export function validateExternalUrl(raw: string | null | undefined): UrlValidation {
  if (!raw) return { safe: null, reason: null }
  const trimmed = raw.trim()
  if (!trimmed) return { safe: null, reason: null }

  // Reject obvious script-bearing schemes via prefix check before we even
  // try to parse — `new URL('javascript:alert(1)')` is a valid URL object
  // and would otherwise sneak past us.
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return { safe: null, reason: 'Only http(s) URLs are allowed.' }
  }

  // If the user typed a bare host like "example.com/me", coerce to https://.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { safe: null, reason: 'That doesn\'t look like a valid URL.' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: null, reason: 'Only http(s) URLs are allowed.' }
  }

  return { safe: parsed.toString(), reason: null }
}

/** Convenience: returns a safe href or null without surfacing reason. */
export function safeExternalHref(raw: string | null | undefined): string | null {
  return validateExternalUrl(raw).safe
}
