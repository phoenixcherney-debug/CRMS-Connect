// Task 1 — CRMS-specific add-on list. Empty by default; the registrar
// may extend it as patterns emerge in moderation. Kept separate from
// textFilter.ts so a future migration to an npm word list can swap the
// base file without losing the local overrides.

export const EXTRA_BLOCKED_TERMS: string[] = [
  // Examples — uncomment / extend as the school requests.
  // 'specificslur',
]
