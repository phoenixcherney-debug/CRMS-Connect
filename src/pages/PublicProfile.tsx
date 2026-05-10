import { useEffect, useState } from 'react'
import type React from 'react'
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom'
import { ChevronLeft, MessageSquare, User, Briefcase, Heart, Calendar, Clock, Send, Github, Globe, Linkedin, ExternalLink, FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, CareerHistory } from '../types'
import { ROLE_LABELS, MENTOR_TYPE_LABELS, STUDENT_SEEKING_PUBLIC } from '../types'
import Spinner from '../components/Spinner'
import ReportUserButton from '../components/ReportUserButton'
import ShortlistButton from '../components/ShortlistButton'
import { initialsOf } from '../lib/initials'

interface AvailSlot {
  id: string
  date: string
  start_time: string
  end_time: string
  title: string | null
  /** Phase 3.1 — IANA zone the mentor authored the slot in. */
  timezone: string | null
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>()
  const { profile: myProfile } = useAuth()
  const navigate = useNavigate()
  const [person, setPerson] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [careerHistory, setCareerHistory] = useState<CareerHistory[]>([])
  const [slots, setSlots] = useState<AvailSlot[]>([])
  const [selectedSlot, setSelectedSlot] = useState<AvailSlot | null>(null)
  const [meetingNote, setMeetingNote] = useState('')
  const [meetingSubmitting, setMeetingSubmitting] = useState(false)
  const [meetingSuccess, setMeetingSuccess] = useState(false)
  const [meetingError, setMeetingError] = useState<string | null>(null)
  // Phase 2.1 — signed URL for the student's default resume PDF, only for
  // viewers permitted by storage RLS (owner / poster of accepted application).
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)

  const isEM = person?.role === 'employer_mentor'

  useEffect(() => {
    async function load() {
      if (!id) return
      // Fire all three queries in parallel. Career history + availability are
      // empty for non-EM profiles so we don't lose anything by querying them
      // unconditionally — and we get a single round-trip instead of three.
      const today = new Date().toISOString().split('T')[0]
      const [{ data }, { data: career }, { data: slotData }] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            id, full_name, role, graduation_year, bio, avatar_url, company, industry,
            open_to_mentorship, meeting_request_mode, created_at, interests, weekly_availability,
            grade, share_grade_with_employers, mentor_type, mentor_type_other,
            student_seeking, student_seeking_other,
            skills, projects, links, default_resume_path
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('career_history')
          .select('*')
          .eq('profile_id', id)
          .order('is_current', { ascending: false })
          .order('start_year', { ascending: false }),
        supabase
          .from('availability_slots')
          .select('id, date, start_time, end_time, title, timezone')
          .eq('user_id', id)
          .gte('date', today)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(10),
      ])

      setPerson(data as Profile)
      if (data && data.role === 'employer_mentor') {
        setCareerHistory((career as CareerHistory[]) ?? [])
        setSlots((slotData as AvailSlot[]) ?? [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (person?.full_name) {
      document.title = `${person.full_name} · CRMS Connect`
    }
  }, [person?.full_name])

  // Phase 2.1 — fetch a signed URL only when the viewer is allowed to read
  // the resume (storage RLS will reject otherwise; we just don't render).
  useEffect(() => {
    if (!person?.default_resume_path) { setResumeUrl(null); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.storage
        .from('resumes')
        .createSignedUrl(person.default_resume_path!, 60 * 10)
      if (!cancelled) setResumeUrl(data?.signedUrl ?? null)
    })()
    return () => { cancelled = true }
  }, [person?.default_resume_path])

  async function openConversation() {
    if (!myProfile || !person) return
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${myProfile.id},participant_two.eq.${person.id}),` +
        `and(participant_one.eq.${person.id},participant_two.eq.${myProfile.id})`
      )
      .maybeSingle()

    if (existing) {
      navigate(`/messages/${existing.id}`)
      return
    }

    const [p1, p2] = [myProfile.id, person.id].sort()
    const { data } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()
    if (data) navigate(`/messages/${data.id}`)
  }

  async function handleMeetingRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!myProfile || !person || !selectedSlot) return
    setMeetingError(null)
    setMeetingSubmitting(true)

    const { error } = await supabase.from('meeting_requests').insert({
      requester_id: myProfile.id,
      recipient_id: person.id,
      slot_id: selectedSlot.id,
      requested_date: selectedSlot.date,
      requested_start_time: selectedSlot.start_time,
      requested_end_time: selectedSlot.end_time,
      note: meetingNote.trim() || null,
    })

    setMeetingSubmitting(false)
    if (error) {
      setMeetingError('Failed to send request. Please try again.')
      return
    }
    setMeetingSuccess(true)
    setSelectedSlot(null)
    setMeetingNote('')
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  // Same-role privacy guard. Audit M11 lifts this for students-students so
  // a student can view another student's profile (name, grade [opt-in],
  // bio); employer/mentor accounts still can't view each other to keep
  // the directory's role separation intact.
  if (
    !loading
    && person
    && person.id !== myProfile?.id
    && person.role === myProfile?.role
    && person.role !== 'student'
  ) {
    return <Navigate to="/people" replace />
  }

  if (!person) {
    const backHref = myProfile?.role === 'student' ? '/mentors' : '/students'
    const backLabel = myProfile?.role === 'student' ? 'Mentors' : 'Students'
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted">This profile could not be found.</p>
        <Link to={backHref} className="mt-3 inline-block text-sm text-primary hover:text-primary-light">
          &larr; Back to {backLabel}
        </Link>
      </div>
    )
  }

  // Audit M1 — back link reflects the directory the viewer most likely came
  // from (their role-specific list). Students viewing students keep /students.
  const directoryHref =
    person.role === 'student'
      ? '/students'
      : person.role === 'employer_mentor'
        ? '/mentors'
        : '/people'

  const initials = initialsOf(person.full_name)
  const isSelf = person.id === myProfile?.id

  // Display labels for sub-role fields
  const mentorTypeLabel = person.mentor_type === 'other'
    ? (person.mentor_type_other || 'Other')
    : person.mentor_type ? MENTOR_TYPE_LABELS[person.mentor_type] : null
  // P1-8 — use the spelled-out public form ("A job or internship and a
  // mentor") instead of the raw "Both" enum.
  const studentSeekingLabel = person.student_seeking === 'other'
    ? (person.student_seeking_other || STUDENT_SEEKING_PUBLIC.other)
    : person.student_seeking ? STUDENT_SEEKING_PUBLIC[person.student_seeking] : null

  return (
    <div className="max-w-xl mx-auto">
      {/* Audit task 29 — go back via history when there is one (i.e. the
          user got here from another in-app page) so the link returns to
          /students, /postings, /explore, etc. depending on the actual
          referrer. Falls back to the role-specific directory when there's
          no history (direct link, fresh tab). */}
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) {
            navigate(-1)
          } else {
            navigate(directoryHref)
          }
        }}
        className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6 bg-transparent border-0 p-0 cursor-pointer"
      >
        <ChevronLeft size={16} />
        Back
      </button>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* M-04 — accent bar in place of the empty 128px gradient banner. */}
        <div
          className="h-1"
          style={{
            background: 'linear-gradient(90deg, #2D5016 0%, #3A6B1E 50%, #4A7C2F 100%)',
          }}
        />

        <div className="px-6 pb-6 pt-6 relative">
          {/* Avatar + name */}
          <div className="mb-5 flex items-end gap-4">
            <div className="w-16 h-16 rounded-2xl border-4 border-surface bg-primary-muted flex items-center justify-center overflow-hidden shrink-0">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.full_name}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span className="text-primary font-bold text-xl">{initials}</span>
              )}
            </div>
            <div className="pb-1 flex-1">
              <p className="font-semibold text-ink text-lg">{person.full_name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* P1-19 — chip and table now agree. For EM accounts the
                    chip shows the sub-role (Employer / Mentor / Employer&Mentor /
                    Other); for students it stays as the broad role. */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">
                  <User size={11} />
                  {isEM && mentorTypeLabel ? mentorTypeLabel : ROLE_LABELS[person.role]}
                </span>
                {/* A.1 — gate grade chip on share_grade_with_employers. The
                    owner sees their own grade either way (isSelf branch). */}
                {person.grade && (isSelf || person.share_grade_with_employers) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-border text-ink-secondary text-xs font-medium">
                    {person.grade}
                  </span>
                )}
                {isEM && person.open_to_mentorship && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success-bg text-success text-xs font-medium"
                    title={
                      ((person.meeting_request_mode as 'flexible' | 'slots' | null | undefined) ?? 'flexible') === 'flexible'
                        ? 'Flexible scheduling — students propose a time'
                        : 'Picks from posted availability slots'
                    }
                  >
                    <Heart size={11} />
                    {((person.meeting_request_mode as 'flexible' | 'slots' | null | undefined) ?? 'flexible') === 'flexible'
                      ? 'Open to mentorship · flexible'
                      : 'Open to mentorship'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Info card */}
            <div className="p-3 rounded-lg bg-primary-faint border border-border text-sm space-y-1.5">
              <div className="flex gap-2">
                <span className="font-medium text-ink w-28 shrink-0">Member since</span>
                <span className="text-ink-secondary">
                  {new Date(person.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              {/* A.1 — for students, the cohort year is just as identifying
                  as the grade itself, so it's gated on the same toggle.
                  Non-students (EM with grad year) are unaffected. */}
              {person.graduation_year && (
                person.role !== 'student' || isSelf || person.share_grade_with_employers
              ) && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Class of</span>
                  <span className="text-ink-secondary">{person.graduation_year}</span>
                </div>
              )}
              {person.role === 'student' && studentSeekingLabel && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Looking for</span>
                  <span className="text-ink-secondary">{studentSeekingLabel}</span>
                </div>
              )}
              {isEM && person.company && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Company</span>
                  <span className="text-ink-secondary">{person.company}</span>
                </div>
              )}
              {isEM && person.industry && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Industry</span>
                  <span className="text-ink-secondary">{person.industry}</span>
                </div>
              )}
              {isEM && mentorTypeLabel && (
                <div className="flex gap-2">
                  {/* Audit task 21 — "Role" disambiguates from the student
                      "Looking for: Both" elsewhere on this same page. */}
                  <span className="font-medium text-ink w-28 shrink-0">Role</span>
                  <span className="text-ink-secondary">{mentorTypeLabel}</span>
                </div>
              )}
              {person.weekly_availability && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Availability</span>
                  <span className="text-ink-secondary">{person.weekly_availability}</span>
                </div>
              )}
            </div>

            {/* Interests (students) */}
            {person.interests && person.interests.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {person.interests.map((interest) => (
                    <span key={interest} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary-muted text-primary">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {person.bio ? (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Bio</p>
                <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{person.bio}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted italic">This user hasn't added a bio yet.</p>
            )}

            {/* Phase 2.1 — student sections. Each block hides when empty
                (brief: "When unpopulated, the section is hidden, not shown empty"). */}
            {person.role === 'student' && person.skills && person.skills.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {person.skills.map((s, i) => (
                    <span key={s + i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {person.role === 'student' && person.projects && person.projects.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Projects</p>
                <div className="space-y-2">
                  {person.projects.map((p, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-primary-faint text-sm">
                      <p className="font-medium text-ink flex items-center gap-1.5">
                        {p.title}
                        {p.url && (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-light inline-flex items-center"
                            aria-label="Open project link"
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </p>
                      {p.description && (
                        <p className="text-ink-secondary text-xs mt-1 leading-relaxed">{p.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {person.role === 'student' && person.links && Object.values(person.links).some(Boolean) && (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Links</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {person.links.github && (
                    <a
                      href={person.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-ink-secondary hover:text-primary"
                    >
                      <Github size={12} /> GitHub
                    </a>
                  )}
                  {person.links.website && (
                    <a
                      href={person.links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-ink-secondary hover:text-primary"
                    >
                      <Globe size={12} /> Site
                    </a>
                  )}
                  {person.links.linkedin && (
                    <a
                      href={person.links.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-ink-secondary hover:text-primary"
                    >
                      <Linkedin size={12} /> LinkedIn
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Resume link only shows when the viewer can actually read it. */}
            {person.role === 'student' && person.default_resume_path && resumeUrl && (
              <div>
                <p className="text-sm font-medium text-ink mb-1.5">Resume</p>
                <a
                  href={resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary-light font-medium"
                >
                  <FileText size={13} /> View resume (PDF)
                </a>
              </div>
            )}

            {/* Career History (employer/mentor only) */}
            {isEM && (
              <div>
                <p className="text-sm font-medium text-ink mb-2 flex items-center gap-1.5">
                  <Briefcase size={14} className="text-ink-muted" />
                  Career History
                </p>
                {careerHistory.length > 0 ? (
                  <div className="space-y-2">
                    {careerHistory.map((entry) => (
                      <div key={entry.id} className="p-3 rounded-lg bg-primary-faint border border-border text-sm">
                        <p className="font-medium text-ink">{entry.title}</p>
                        <p className="text-ink-secondary">{entry.company} · {entry.start_year}–{entry.is_current ? 'Present' : entry.end_year ?? ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted italic">No career history added yet.</p>
                )}
              </div>
            )}

            {/* P2-14 — meeting request UI varies by the mentor's contact
                preference. 'flexible' (default) shows a free-form date+time
                picker; 'slots' shows the published-slot list (legacy
                behavior). Hidden when the mentor isn't open to mentorship. */}
            {(() => {
              if (!(isEM && !isSelf && myProfile?.role === 'student' && person.open_to_mentorship)) return null
              const mode = (person.meeting_request_mode as 'flexible' | 'slots' | null | undefined) ?? 'flexible'
              if (mode === 'flexible') return null /* rendered below */
              if (mode === 'slots' && slots.length === 0 && !meetingSuccess) return null
              return null
            })()}
            {isEM && !isSelf && myProfile?.role === 'student' && person.open_to_mentorship && (
              ((person.meeting_request_mode as 'flexible' | 'slots' | null | undefined) ?? 'flexible') === 'flexible'
            ) ? (
              <div>
                <p className="text-sm font-medium text-ink mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-ink-muted" />
                  Request a meeting
                </p>
                {meetingSuccess ? (
                  <div className="flex items-center gap-2 rounded-lg bg-success-bg border border-status-accepted-border px-4 py-3">
                    <Send size={14} className="text-success shrink-0" />
                    <p className="text-sm text-success font-medium">Meeting request sent!</p>
                  </div>
                ) : (
                  <FlexibleMeetingForm
                    onSubmit={async ({ date, start, end, note }) => {
                      if (!myProfile || !person) return { error: 'Sign in to send a request.' }
                      const { error } = await supabase.from('meeting_requests').insert({
                        requester_id: myProfile.id,
                        recipient_id: person.id,
                        slot_id: null,
                        requested_date: date,
                        requested_start_time: start,
                        requested_end_time: end,
                        note: note || null,
                      })
                      if (error) return { error: 'Failed to send request. Please try again.' }
                      setMeetingSuccess(true)
                      return { error: null }
                    }}
                  />
                )}
              </div>
            ) : isEM && !isSelf && myProfile?.role === 'student' && person.open_to_mentorship && (slots.length > 0 || meetingSuccess) && (
              <div>
                <p className="text-sm font-medium text-ink mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-ink-muted" />
                  Request a meeting
                </p>
                {meetingSuccess ? (
                  <div className="flex items-center gap-2 rounded-lg bg-success-bg border border-status-accepted-border px-4 py-3">
                    <Send size={14} className="text-success shrink-0" />
                    <p className="text-sm text-success font-medium">Meeting request sent!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid gap-2">
                      {slots.map((slot) => (
                        <button type="button"
                          key={slot.id}
                          onClick={() => setSelectedSlot(selectedSlot?.id === slot.id ? null : slot)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors
                            ${selectedSlot?.id === slot.id
                              ? 'border-primary bg-primary-muted text-primary'
                              : 'border-border bg-surface hover:bg-primary-faint text-ink-secondary'
                            }`}
                        >
                          <span className="font-medium">{format(parseISO(slot.date), 'EEE, MMM d')}</span>
                          <span className="ml-2 text-xs">
                            <Clock size={10} className="inline mr-0.5" />
                            {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
                            {slot.timezone && (
                              <span className="ml-1 text-ink-muted">
                                ({slot.timezone.split('/').pop()?.replace('_', ' ')})
                              </span>
                            )}
                          </span>
                          {slot.title && <span className="ml-2 text-xs text-ink-muted">· {slot.title}</span>}
                        </button>
                      ))}
                    </div>

                    {selectedSlot && (
                      <form onSubmit={handleMeetingRequest} className="mt-3 space-y-3 p-3 rounded-lg border border-border bg-primary-faint">
                        <p className="text-xs font-medium text-ink">
                          Requesting: {format(parseISO(selectedSlot.date), 'EEE, MMM d')} at {fmtTime(selectedSlot.start_time)}
                        </p>
                        <div>
                          <label className="block text-xs font-medium text-ink mb-1">
                            Note <span className="text-ink-muted font-normal">(optional)</span>
                          </label>
                          <textarea
                            rows={2}
                            value={meetingNote}
                            onChange={(e) => setMeetingNote(e.target.value)}
                            placeholder="What would you like to discuss?"
                            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm
                              placeholder:text-ink-placeholder resize-none
                              focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                          />
                        </div>
                        {meetingError && (
                          <p className="text-xs text-error">{meetingError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={meetingSubmitting}
                            className="btn-gold text-sm px-4 py-2"
                          >
                            {meetingSubmitting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={13} />}
                            {meetingSubmitting ? 'Sending…' : 'Send request'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedSlot(null)}
                            className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* P0-6 — same-role DM block was removed (the trigger that
                rejected mentor↔mentor inserts is dropped in 057). Anyone
                signed in can DM anyone except themselves. */}
            {!isSelf && (
              <>
                <div className="flex gap-2 items-stretch">
                  <button type="button"
                    onClick={openConversation}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                      border border-border text-sm font-medium text-ink-secondary
                      hover:bg-primary-faint hover:text-ink transition-colors"
                  >
                    <MessageSquare size={15} />
                    Message {person.full_name.trim() || 'this person'}
                  </button>
                  {person.role === 'student' && (
                    <ShortlistButton studentId={person.id} size={16} className="px-3 py-2.5" />
                  )}
                </div>
                {/* SEC-003 — flag a problematic profile to school staff. */}
                <div className="flex justify-center">
                  <ReportUserButton targetId={person.id} targetName={person.full_name} />
                </div>
              </>
            )}

            {isSelf && (
              <Link
                to="/profile"
                className="block w-full text-center px-4 py-2.5 rounded-lg
                  border border-border text-sm font-medium text-primary
                  hover:bg-primary-faint transition-colors"
              >
                Edit your profile
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// P2-14 — free-form meeting request form for mentors in 'flexible' mode.
function FlexibleMeetingForm({
  onSubmit,
}: {
  onSubmit: (vals: { date: string; start: string; end: string; note: string }) => Promise<{ error: string | null }>
}) {
  const [date,  setDate]  = useState('')
  const [start, setStart] = useState('')
  const [end,   setEnd]   = useState('')
  const [note,  setNote]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const todayIso = new Date().toISOString().split('T')[0]

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!date || !start || !end) { setError('Pick a date, start, and end time.'); return }
    if (start >= end) { setError('End time must be after start.'); return }
    if (date < todayIso) { setError('Pick a date today or later.'); return }
    setSubmitting(true)
    const res = await onSubmit({ date, start, end, note: note.trim() })
    setSubmitting(false)
    if (res.error) setError(res.error)
  }

  return (
    <form onSubmit={handle} className="space-y-3 p-3 rounded-lg border border-border bg-primary-faint">
      <p className="text-xs text-ink-muted">
        Propose a date and time. The mentor can accept, decline, or counter.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-ink mb-1">Date</label>
          <input
            type="date"
            value={date}
            min={todayIso}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink mb-1">Start</label>
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink mb-1">End</label>
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-ink mb-1">
          Note <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What would you like to discuss?"
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <button type="submit" disabled={submitting} className="btn-gold text-sm px-4 py-2">
        {submitting ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={13} />}
        {submitting ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}
