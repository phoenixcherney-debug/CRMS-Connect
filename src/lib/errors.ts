// ─────────────────────────────────────────────────────────────────────────────
// Central error → user copy mapper.
//
// Every Supabase / fetch call's error handler should run its error through
// `friendlyError()` before assigning it to a form's error state. Raw Postgres
// strings (column / constraint names, "null value in column …") are leaks of
// internal schema and read like bug reports — never show them to the user.
//
// The raw error is logged to the console for debugging.
// ─────────────────────────────────────────────────────────────────────────────

interface MaybeSupabaseError {
  code?: string
  message?: string
  details?: string
  hint?: string
  status?: number
}

export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback

  const e = err as MaybeSupabaseError
  const raw = (e.message ?? String(err)).trim()
  const code = e.code

  // Always log the raw error — invaluable in DevTools when debugging.
  console.error('[friendlyError]', { code, raw, details: e.details, hint: e.hint })

  const lower = raw.toLowerCase()

  // ── Postgres SQLSTATEs (most reliable signal) ────────────────────────────
  if (code === '23502' || lower.includes('null value in column') || lower.includes('not-null')) {
    return 'Please fill in all required fields and try again.'
  }
  if (code === '23505' || lower.includes('duplicate key') || lower.includes('unique constraint')) {
    return 'An entry like this already exists.'
  }
  if (code === '23503' || lower.includes('foreign key constraint')) {
    return "We couldn't link that change to your account. Please refresh and try again."
  }
  if (code === '23514' || lower.includes('check constraint')) {
    return 'One of the fields has an invalid value. Please review the form and try again.'
  }
  if (code === '42703' || lower.includes('column') && lower.includes('does not exist')) {
    // Schema/code drift — this is a real bug, not user error. Tell the user
    // it's our problem (don't blame them or expose the column name) and let
    // the console log surface the detail to whoever's debugging.
    return 'Something went wrong on our end. Please try again in a moment.'
  }

  // ── RLS / permissions ────────────────────────────────────────────────────
  if (
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('rls') ||
    lower.includes('not authorized')
  ) {
    return "You don't have permission to do that."
  }

  // ── Auth-specific (let these through verbatim where they're already friendly) ──
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Please log in.'
  }
  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email before signing in. Check your inbox for the verification link.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (lower.includes('weak password')) {
    return 'Please use a stronger password (at least 8 characters).'
  }

  // ── Network / fetch ──────────────────────────────────────────────────────
  if (
    lower === 'failed to fetch' ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('fetch failed')
  ) {
    return "We're having trouble reaching the server. Check your internet connection and try again."
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return 'The request timed out. Please check your connection and try again.'
  }

  // ── Database-flavored phrases that still look like jargon ────────────────
  if (lower.startsWith('database error') || lower.includes('relation ')) {
    return 'Something went wrong on our end. Please try again in a moment.'
  }

  // Last-ditch: if the message looks like a normal sentence, show it; otherwise
  // hide it behind the fallback. Postgres errors typically include things like
  // "(SQLSTATE 12345)" or column names in double-quotes.
  if (raw.length > 0 && raw.length < 160 && !/^[A-Z]+:/.test(raw) && !/"[a-z_]+"/.test(raw)) {
    return raw
  }
  return fallback
}
