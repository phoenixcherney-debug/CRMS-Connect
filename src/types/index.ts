export type Role = 'student' | 'alumni' | 'parent'
export type JobType = 'internship' | 'part-time' | 'full-time' | 'volunteer'
export type ApplicationStatus = 'pending' | 'reviewed' | 'accepted' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  role: Role
  graduation_year?: number | null
  bio?: string | null
  avatar_url?: string | null
  onboarding_complete: boolean
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
  deadline: string | null
  is_active: boolean
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
}

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Student',
  alumni: 'Alumni',
  parent: 'Parent',
}
