export type Role = 'student' | 'employer_mentor' | 'admin'
// Single taxonomy that covers what was previously split between job_type and
// opportunity_type. The latter is being phased out; existing rows still
// surface their opportunity_type label on detail pages.
export type JobType =
  | 'internship'
  | 'part-time'
  | 'full-time'
  | 'volunteer'
  | 'mentorship'
  | 'shadow'
  | 'other'
export type LocationType = 'remote' | 'in-person' | 'hybrid'
export type ApplicationStatus =
  | 'pending'
  | 'reviewed'
  | 'accepted'
  | 'rejected'
  | 'waitlisted'
  // P2-18 — intermediate hiring states (migration 052).
  | 'interview_scheduled'
  | 'offer_sent'
  | 'started'
  | 'completed'
  | 'withdrawn_by_employer'
export type MentorType = 'employer' | 'mentor' | 'both' | 'other'
export type StudentSeeking = 'job' | 'mentor' | 'both' | 'other'
export type OpportunityType = 'job_internship' | 'mentorship' | 'volunteer' | 'shadow' | 'other'

export const STUDENT_GRADES = ['9th', '10th', '11th', '12th', 'Gap Year'] as const
export type StudentGrade = typeof STUDENT_GRADES[number]

export interface Profile {
  id: string
  full_name: string
  role: Role
  graduation_year?: number | null
  bio?: string | null
  avatar_url?: string | null
  company?: string | null
  industry?: string | null
  open_to_mentorship: boolean
  onboarding_complete: boolean
  interests: string[]
  interests_other?: string | null
  weekly_availability: string | null
  mentor_type?: MentorType | null
  mentor_type_other?: string | null
  student_seeking?: StudentSeeking | null
  student_seeking_other?: string | null
  grade?: StudentGrade | null
  /** Audit M9: students opt in before their grade is exposed to other roles. */
  share_grade_with_employers?: boolean
  /** SEC-001 — staff-approval gate for employer/mentor signups. */
  account_status?: 'pending' | 'active' | 'disabled'
  /** P2-14 — for mentors with open_to_mentorship=true. */
  meeting_request_mode?: 'flexible' | 'slots' | null
  /** P1-10 — when set to a future date, hides the mentor from /mentors
   *  even though open_to_mentorship is true (for parental leave / busy
   *  season). Past dates are no-ops. */
  mentorship_paused_until?: string | null
  /** P1-12 — per-category push toggles. Missing keys default to "send". */
  notification_preferences?: Record<string, boolean> | null
  /** Phase 1.2 — gates the one-time post-signup mentor-visibility
   *  interstitial. Server-stored so it's once-per-account, not
   *  once-per-device. */
  seen_mentor_visibility_card?: boolean | null
  created_at: string
  banned_at?: string | null
}

export interface CareerHistory {
  id: string
  profile_id: string
  company: string
  title: string
  start_year: number
  end_year?: number | null
  is_current: boolean
  created_at: string
}

export interface AvailabilitySlot {
  id: string
  user_id: string
  title: string | null
  date: string
  start_time: string
  end_time: string
  is_recurring: boolean
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | null
  recurrence_end_date: string | null
  created_at: string
}

export interface Job {
  id: string
  created_at: string
  posted_by: string
  title: string
  company: string
  location: string
  job_type: JobType
  description: string
  how_to_apply: string
  contact_email: string
  location_type: LocationType
  industry?: string | null
  deadline: string | null
  is_active: boolean
  expected_weekly_hours?: string | null
  /** P2-36 — optional free-text compensation ("$22/hr", "Unpaid", …). */
  compensation?: string | null
  opportunity_type?: OpportunityType | null
  opportunity_type_other?: string | null
  start_date?: string | null
  end_date?: string | null
  /** P1-7 — up to 3 free-text questions the applicant must answer. */
  custom_questions?: string[] | null
  /** P1-4 — drafts skip not-blank checks; never show in directory. */
  is_draft?: boolean
  // Joined
  profiles?: Profile | null
}

export interface StudentPost {
  id: string
  student_id: string
  pitch: string
  seeking: StudentSeeking
  seeking_other?: string | null
  interests: string[]
  availability?: string | null
  is_closed: boolean
  created_at: string
  // Joined
  profiles?: Profile | null
}

export interface Application {
  id: string
  created_at: string
  job_id: string
  applicant_id: string
  cover_note: string
  resume_link?: string | null
  /** P1-8 — storage path under the `resumes` bucket
   *  (`resumes/<application_id>/<filename>.pdf`). Only the applicant +
   *  the post owner with status='accepted' can read via storage RLS. */
  resume_path?: string | null
  status: ApplicationStatus
  /** P1-7 — answers to opportunity.custom_questions, snapshotted at submit
   *  so the applicant's record stays meaningful even if the poster later
   *  edits or reorders the questions. */
  custom_answers?: { question: string; answer: string }[] | null
  // Joined
  jobs?: Job | null
  profiles?: Profile | null
}

export interface Conversation {
  id: string
  created_at: string
  participant_one: string
  participant_two: string
  otherProfile?: Profile
  lastMessage?: Message
  unreadCount?: number
}

export interface Message {
  id: string
  created_at: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  /** P1-4 — system-authored auto-messages (e.g. "Application accepted by …")
   *  render with distinct styling. */
  is_system?: boolean
  profiles?: Profile | null
}

// ─── Label maps ─────────────────────────────────────────────────────────────

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  internship: 'Internship',
  'part-time': 'Part-Time',
  'full-time': 'Full-Time',
  volunteer: 'Volunteer',
  mentorship: 'Mentorship',
  shadow: 'Job Shadow',
  other: 'Other',
}

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  job_internship: 'Job / Internship',
  mentorship: 'Mentorship',
  volunteer: 'Volunteer',
  shadow: 'Shadow',
  other: 'Other',
}

export const MENTOR_TYPE_LABELS: Record<MentorType, string> = {
  employer: 'Employer',
  mentor: 'Mentor',
  // NAV-011 — match the signup-page button label and ROLE_LABELS, which
  // both use the slash. (Earlier audit pass had this as ampersand to
  // disambiguate from the student "Both", but the slash matches the rest
  // of the platform.)
  both: 'Employer / Mentor',
  other: 'Other',
}

export const STUDENT_SEEKING_LABELS: Record<StudentSeeking, string> = {
  job: 'A job / internship',
  mentor: 'A mentor',
  both: 'Both',
  // Distinct label so it doesn't visually collide with the "Other" chip in
  // the Areas-of-interest list on the same form (audit §18).
  other: 'Something else',
}

/** P1-8 — public profile rendering uses the spelled-out form so "Looking
 *  for: Both" stops being context-free. The short form above is for
 *  buttons / chips where space is tight. */
export const STUDENT_SEEKING_PUBLIC: Record<StudentSeeking, string> = {
  job: 'A job or internship',
  mentor: 'A mentor',
  both: 'A job or internship and a mentor',
  other: 'Something else (see bio)',
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
  // P2-18 — intermediate hiring states.
  interview_scheduled: 'Interview scheduled',
  offer_sent: 'Offer sent',
  started: 'Started',
  completed: 'Completed',
  withdrawn_by_employer: 'Withdrawn',
}

export const WEEKLY_AVAILABILITY_OPTIONS = [
  '< 5 hrs/week',
  '5–10 hrs/week',
  '10–20 hrs/week',
  '20+ hrs/week',
] as const

export const EXPECTED_HOURS_OPTIONS = WEEKLY_AVAILABILITY_OPTIONS

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  remote: 'Remote',
  'in-person': 'In-Person',
  hybrid: 'Hybrid',
}

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  employer_mentor: 'Employer / Mentor',
  admin: 'Admin',
}

export const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export const INDUSTRY_OPTIONS = [
  'Technology',
  'Finance & Banking',
  'Healthcare & Medicine',
  'Education',
  'Law & Legal',
  'Arts & Entertainment',
  'Environmental & Sustainability',
  'Non-Profit & Social Impact',
  'Engineering',
  'Marketing & Communications',
  'Consulting',
  'Government & Public Policy',
  'Agriculture & Ranching',
  'Hospitality & Tourism',
  'Science & Research',
  'Architecture & Design',
  'Real Estate',
  'Sports & Recreation',
  'Other',
] as const

export const INTEREST_OPTIONS = INDUSTRY_OPTIONS
