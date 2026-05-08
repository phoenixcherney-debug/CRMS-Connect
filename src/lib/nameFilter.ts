// Display-name moderation. SEC-003.
//
// Two passes:
//  1. SLUR_PATTERNS — regex-flagged hits are rejected outright.
//  2. SEXUAL_PATTERNS — same.
//
// Kept short on purpose: the registrar reviews edge cases via
// /admin/reports. The point isn't to be exhaustive but to catch the
// obvious "Pheonix likes little boys" / "Mr. f-bomb" / "n-word smith"
// class of payload before it shows up in the directory.
//
// Patterns are case-insensitive and tolerate the basic l33t-speak
// substitutions (i↔1, e↔3, a↔@4, o↔0, s↔$5, t↔7).

function expandLeet(re: string): RegExp {
  const subs: Record<string, string> = {
    a: '[a4@]',
    e: '[e3]',
    i: '[i1!]',
    l: '[l1]',
    o: '[o0]',
    s: '[s$5]',
    t: '[t7]',
  }
  // The haystack is flattened to alphanumerics-only before matching, so
  // \b anchors don't apply. Match anywhere in the flat string.
  const expanded = re
    .toLowerCase()
    .split('')
    .map((c) => subs[c] ?? (/[a-z]/.test(c) ? c : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(expanded, 'i')
}

const SLUR_WORDS = [
  'nigger', 'nigga', 'faggot', 'retard', 'tranny', 'kike', 'spic',
  'chink', 'gook', 'wetback', 'coon', 'cunt',
]

const SEXUAL_WORDS = [
  'pedo', 'rapist', 'molester',
  // Common "X likes Y" pattern that the live test row used.
  'likeslittleboys', 'likeslittlegirls',
]

const SLUR_PATTERNS = SLUR_WORDS.map(expandLeet)
const SEXUAL_PATTERNS = SEXUAL_WORDS.map(expandLeet)

const IMPERSONATION = [
  // Reserve obvious staff / platform names.
  /\bregistrar\b/i,
  /\b(?:crms\s*)?staff\b/i,
  /\badmin(?:istrator)?\b/i,
  /\bmoderator\b/i,
]

export interface NameValidation {
  ok: boolean
  reason: string | null
}

/** Returns ok=false (with a generic reason) if the display name should be
 *  rejected. The reason text is intentionally generic so the deny-list
 *  isn't exposed to the caller. */
export function validateDisplayName(rawName: string): NameValidation {
  const name = (rawName ?? '').trim()
  if (!name) return { ok: false, reason: 'Please enter your name.' }
  if (name.length < 2 || name.length > 80) {
    return { ok: false, reason: 'Display names must be 2–80 characters.' }
  }
  // Strip whitespace + non-alphanumerics to defeat "p h o e n i x". Keep
  // common l33t-speak punctuation ($, @, !) so "f@ggot" still matches.
  const flat = name.toLowerCase().replace(/[^a-z0-9$@!]+/g, '')
  for (const re of [...SLUR_PATTERNS, ...SEXUAL_PATTERNS]) {
    if (re.test(flat)) {
      return { ok: false, reason: 'That display name isn\'t allowed. Pick another.' }
    }
  }
  for (const re of IMPERSONATION) {
    if (re.test(name)) {
      return { ok: false, reason: 'That display name isn\'t allowed. Pick another.' }
    }
  }
  return { ok: true, reason: null }
}
