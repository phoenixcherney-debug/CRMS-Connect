// Pure helpers extracted from OfferForm so the spots clamp and the
// draft→open status derivation are testable in isolation (review Major T-04).

import { MAX_SPOTS, MIN_SPOTS } from './constants'
import type { OfferStatus } from '../types'

/** Clamp a spots input (string from the number field, or a number) to the
 *  schema's 1–20 range, defaulting to 1 for empty/NaN input. */
export function clampSpots(value: string | number): number {
  return Math.min(MAX_SPOTS, Math.max(MIN_SPOTS, Number(value) || MIN_SPOTS))
}

/** The offer status to persist for a save action:
 *  - "Save as draft" always yields 'draft'.
 *  - Publishing a current draft promotes it to 'open'.
 *  - Any other publish keeps the chosen status (open/filled/closed). */
export function deriveOfferStatus(current: OfferStatus, asDraft: boolean): OfferStatus {
  if (asDraft) return 'draft'
  return current === 'draft' ? 'open' : current
}
