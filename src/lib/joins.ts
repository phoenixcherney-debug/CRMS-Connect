// Canonical embedded-join fragments + their row types (review Architecture A-01).
// The poster/student profile embeds were hand-written with divergent column
// lists across ~9 pages and force-cast, so `tsc` never checked them. Import
// these instead: one canonical column list each, changed in a single place.

import type { Offer, PublicProfile } from '../types'

// --- Offer → poster -------------------------------------------------------
export type OfferPoster = Pick<
  PublicProfile,
  'id' | 'full_name' | 'role' | 'affiliation' | 'class_year' | 'organization'
>

/** Poster identity shown on board cards, home lists, and profile listings. */
export const OFFER_POSTER_JOIN =
  'poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year, organization)'

/** The offer-detail page also needs the poster's title + pause switch. */
export const OFFER_POSTER_JOIN_DETAIL =
  'poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year, organization, title, open_to_requests)'

export type OfferWithPoster = Offer & { poster: OfferPoster | null }

// --- Request → student ----------------------------------------------------
export type RequestStudent = Pick<
  PublicProfile,
  'id' | 'full_name' | 'role' | 'affiliation' | 'class_year' | 'organization'
>

/** Student identity shown on a request/thread view. */
export const REQUEST_STUDENT_JOIN =
  'student:profiles!requests_student_id_fkey(id, full_name, role, affiliation, class_year, organization)'

/** The manage view additionally shows the student's interest tags. */
export const REQUEST_STUDENT_JOIN_TAGS =
  'student:profiles!requests_student_id_fkey(id, full_name, role, affiliation, class_year, tags)'
