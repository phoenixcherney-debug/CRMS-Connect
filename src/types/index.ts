export type Role = 'student' | 'employer_mentor'
export type JobType = 'internship' | 'part-time' | 'full-time' | 'volunteer'
export type LocationType = 'remote' | 'in-person' | 'hybrid'
export type ApplicationStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected' | 'waitlisted'
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
  opportunity_type?: OpportunityType | null
  opportunity_type_other?: string | null
  start_date?: string | null
  end_date?: string | null
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
  profiles?: Profile | null
}

// ─── Label maps ─────────────────────────────────────────────────────────────

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  internship: 'Internship',
  'part-time': 'Part-Time',
  'full-time': 'Full-Time',
  volunteer: 'Volunteer',
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
  both: 'Both',
  other: 'Other',
}

export const STUDENT_SEEKING_LABELS: Record<StudentSeeking, string> = {
  job: 'A job / internship',
  mentor: 'A mentor',
  both: 'Both',
  other: 'Other',
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
  employer_mentor: 'Employer / Mentor',
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
