// Task 1 — abuse / slur filter shared across signup, bios, opportunity
// posts, student posts, and DMs. The point isn't to be exhaustive: the
// registrar still reviews edge cases via /admin/reports. The point is to
// catch the obvious "Pheonix likes little boys" class of payload before
// it shows up in user-visible surfaces.
//
// We keep the deny list in source (small, internal use) rather than
// pulling in `naughty-words` for two reasons:
//   1. We don't want to ship a 1000-word client bundle for a handful of
//      check sites.
//   2. The school may want to localize / extend without a package bump.
//      Extra terms go in textFilterExtra.ts so this file can be
//      re-generated mechanically later if we ever switch.
//
// Mirrored server-side by the `text_has_blocked_terms()` SQL function
// in migration 073; the SQL list is intentionally a subset (DB triggers
// can't run JS), but it catches the same slur classes.

import { EXTRA_BLOCKED_TERMS } from './textFilterExtra'

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
  const expanded = re
    .toLowerCase()
    .split('')
    .map((c) => subs[c] ?? (/[a-z]/.test(c) ? c : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(expanded, 'i')
}

// Slurs — hard reject. Mirrors validateDisplayName but lives here so it
// can be reused for bio / opportunity body / DM checks.
const SLUR_WORDS = [
  'nigger', 'nigga', 'faggot', 'retard', 'tranny', 'kike', 'spic',
  'chink', 'gook', 'wetback', 'coon', 'cunt',
]

// Sexual harm / grooming-adjacent text.
const SEXUAL_WORDS = [
  'pedo', 'rapist', 'molester',
  'likeslittleboys', 'likeslittlegirls',
  'lickslittleboys', 'lickslittlegirls',
]

const BLOCKED_PATTERNS = [
  ...SLUR_WORDS.map(expandLeet),
  ...SEXUAL_WORDS.map(expandLeet),
  ...EXTRA_BLOCKED_TERMS.map(expandLeet),
]

// Cyrillic / Greek lookalikes → ASCII. Stops "Phоenix" (Cyrillic о) from
// slipping through.
const LOOKALIKES: Record<string, string> = {
  'а': 'a', // а
  'е': 'e', // е
  'о': 'o', // о
  'р': 'p', // р
  'с': 'c', // с
  'х': 'x', // х
  'у': 'y', // у
  'і': 'i', // і
  'ӏ': 'l', // ӏ
  'α': 'a', // α
  'ο': 'o', // ο
  'ρ': 'p', // ρ
}

function normalizeForMatch(input: string): string {
  const lower = (input ?? '').toLowerCase()
  let out = ''
  for (const ch of lower) out += LOOKALIKES[ch] ?? ch
  // Strip whitespace + non-alphanumerics to defeat "p h o e n i x". Keep
  // common leet punctuation so "f@ggot" still matches.
  return out.replace(/[^a-z0-9$@!]+/g, '')
}

export interface BlockedTermResult {
  blocked: boolean
  reason?: string
}

/** Generic blocked-term check for free-text fields. Returns
 *  blocked=true if any term in the list matches the input. */
export function containsBlockedTerms(text: string): BlockedTermResult {
  const flat = normalizeForMatch(text)
  if (!flat) return { blocked: false }
  for (const re of BLOCKED_PATTERNS) {
    if (re.test(flat)) {
      return {
        blocked: true,
        reason: 'That text contains language we don\'t allow on CRMS Connect. Please revise and try again.',
      }
    }
  }
  return { blocked: false }
}

/** Task 1 — Full-name shape: ≥2 whitespace-separated tokens, each
 *  ≥2 characters, no digits. */
export function validateFullNameShape(rawName: string): BlockedTermResult {
  const name = (rawName ?? '').trim()
  if (!name) return { blocked: true, reason: 'Please enter your name.' }
  if (/\d/.test(name)) {
    return { blocked: true, reason: 'Names shouldn\'t include numbers.' }
  }
  const tokens = name.split(/\s+/)
  if (tokens.length < 2) {
    return { blocked: true, reason: 'Please use your real first and last name.' }
  }
  for (const t of tokens) {
    // Allow common hyphenated / apostrophed surnames (O'Connor, Smith-Jones).
    const clean = t.replace(/[-']/g, '')
    if (clean.length < 2) {
      return { blocked: true, reason: 'Please use your real first and last name.' }
    }
  }
  return { blocked: false }
}
