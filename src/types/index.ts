export type Role = 'student' | 'alumni' | 'parent'
export type JobType = 'internship' | 'part-time' | 'full-time' | 'volunteer'
export type LocationType = 'remote' | 'in-person' | 'hybrid'
export type ApplicationStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected' | 'waitlisted'

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
  weekly_availability: string | null
  created_at: string
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
  date: string                  // YYYY-MM-DD
  start_time: string            // HH:MM or HH:MM:SS
  end_time: string              // HH:MM or HH:MM:SS
  is_recurring: boolean
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | null
  recurrence_end_date: string | null  // YYYY-MM-DD
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
  status: ApplicationStatus
  // Joined
  jobs?: Job | null
  profiles?: Profile | null
}

export interface Conversation {
  id: string
  created_at: string
  participant_one: string
  participant_two: string
  // Processed client-side
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
  // Joined
  profiles?: Profile | null
}

// Helper: label map for UI
export const JOB_TYPE_LABELS: Record<JobType, string> = {
  internship: 'Internship',
  'part-time': 'Part-Time',
  'full-time': 'Full-Time',
  volunteer: 'Volunteer',
}

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  reviewed: 'Reviewed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  waitlisted: 'Waitlisted',
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
  alumni: 'Alumni',
  parent: 'Parent',
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
