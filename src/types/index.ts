// App-level type aliases and display metadata for the v2 domain model.
// Enum → label/tint maps live here so every page renders the same vocabulary.

import type { Database, Tables } from '../lib/database.types'

export type Profile = Tables<'profiles'>
export type Offer = Tables<'offers'>
export type HandRaise = Tables<'requests'>
export type Message = Tables<'messages'>
export type Report = Tables<'reports'>
export type AppNotification = Tables<'notifications'>
export type AuditEntry = Tables<'audit_log'>

export type UserRole = Database['public']['Enums']['user_role']
export type AccountStatus = Database['public']['Enums']['account_status']
export type MemberAffiliation = Database['public']['Enums']['member_affiliation']
export type OfferKind = Database['public']['Enums']['offer_kind']
export type OfferStatus = Database['public']['Enums']['offer_status']
export type LocationMode = Database['public']['Enums']['location_mode']
export type RequestStatus = Database['public']['Enums']['request_status']
export type ReportStatus = Database['public']['Enums']['report_status']
export type ReportTarget = Database['public']['Enums']['report_target']

/** Placeholder for a person whose profile is no longer visible (disabled →
 *  hidden by RLS) but who is still referenced by a visible offer/request/message. */
export const FORMER_MEMBER = 'Former community member'

/** Safe display name for a possibly-null embedded person join. */
export function personName(p: { full_name: string } | null | undefined): string {
  return p?.full_name ?? FORMER_MEMBER
}

/** A profile with only the fields other users are meant to see. */
export type PublicProfile = Pick<
  Profile,
  'id' | 'role' | 'full_name' | 'affiliation' | 'class_year' | 'title' | 'organization' | 'location' | 'bio' | 'tags' | 'account_status'
>
export const PUBLIC_PROFILE_COLUMNS =
  'id, role, full_name, affiliation, class_year, title, organization, location, bio, tags, account_status'

export const OFFER_KINDS: OfferKind[] = [
  'internship', 'job', 'shadow_day', 'mentorship', 'project_help', 'career_chat', 'other',
]

export const OFFER_KIND_META: Record<OfferKind, { label: string; blurb: string; tint: string }> = {
  internship: { label: 'Internship', blurb: 'A stretch of real work, often over a break', tint: 'bg-meadow text-pine' },
  job: { label: 'Job', blurb: 'Part-time or seasonal paid work', tint: 'bg-meadow text-pine' },
  shadow_day: { label: 'Shadow day', blurb: 'Follow someone through a real workday', tint: 'bg-gold-soft text-clay-deep' },
  mentorship: { label: 'Mentorship', blurb: 'Ongoing check-ins with someone in the field', tint: 'bg-clay-soft text-clay-deep' },
  project_help: { label: 'Project', blurb: 'Work on something real together', tint: 'bg-gold-soft text-clay-deep' },
  career_chat: { label: 'Career chat', blurb: 'One conversation, zero commitment', tint: 'bg-meadow text-pine' },
  other: { label: 'Something else', blurb: 'An open door that fits no box', tint: 'bg-paper text-faint' },
}

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  filled: 'Filled',
  closed: 'Closed',
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  disabled: 'Disabled',
}

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
  user: 'Person',
  offer: 'Offer',
  message: 'Message',
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
}

export const LOCATION_MODE_LABEL: Record<LocationMode, string> = {
  in_person: 'In person',
  remote: 'Remote',
  flexible: 'Flexible',
}

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; student: string; tint: string }> = {
  sent: { label: 'Sent', student: 'Waiting for a reply', tint: 'bg-paper text-faint border border-line' },
  in_conversation: { label: 'In conversation', student: 'In conversation', tint: 'bg-meadow text-pine' },
  accepted: { label: 'Accepted', student: 'Accepted', tint: 'bg-pine text-white' },
  declined: { label: 'Declined', student: 'Not this time', tint: 'bg-paper text-faint border border-line' },
  withdrawn: { label: 'Withdrawn', student: 'Withdrawn', tint: 'bg-paper text-faint border border-line' },
}

/** "Class of '02", "CRMS parent", … — the trust badge next to every name. */
export function affiliationLabel(p: Pick<PublicProfile, 'role' | 'affiliation' | 'class_year'>): string {
  if (p.role === 'admin') return 'CRMS staff'
  if (p.role === 'student') {
    return p.class_year ? `Class of ${shortYear(p.class_year)} (student)` : 'Current student'
  }
  switch (p.affiliation) {
    case 'alumni':
      return p.class_year ? `Class of ${shortYear(p.class_year)}` : 'Alum'
    case 'parent':
      return 'CRMS parent'
    case 'faculty_staff':
      return 'Faculty & staff'
    default:
      return 'Friend of the school'
  }
}

function shortYear(year: number): string {
  return `’${String(year).slice(-2)}`
}
