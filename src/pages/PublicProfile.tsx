import { useEffect, useState } from 'react'
import type React from 'react'
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom'
import { ChevronLeft, MessageSquare, User, Briefcase, Heart, Calendar, Clock, Send } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Profile, CareerHistory } from '../types'
import { ROLE_LABELS, MENTOR_TYPE_LABELS, STUDENT_SEEKING_LABELS } from '../types'
import Spinner from '../components/Spinner'

interface AvailSlot {
  id: string
  date: string
  start_time: string
  end_time: string
  title: string | null
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
            open_to_mentorship, created_at, interests, weekly_availability,
            grade, share_grade_with_employers, mentor_type, mentor_type_other,
            student_seeking, student_seeking_other
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
          .select('id, date, start_time, end_time, title')
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
  const directoryLabel =
    person.role === 'student' ? 'Students' : person.role === 'employer_mentor' ? 'Mentors' : 'People'

  const initials = person.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const isSelf = person.id === myProfile?.id

  // Display labels for sub-role fields
  const mentorTypeLabel = person.mentor_type === 'other'
    ? (person.mentor_type_other || 'Other')
    : person.mentor_type ? MENTOR_TYPE_LABELS[person.mentor_type] : null
  const studentSeekingLabel = person.student_seeking === 'other'
    ? (person.student_seeking_other || 'Other')
    : person.student_seeking ? STUDENT_SEEKING_LABELS[person.student_seeking] : null

  return (
    <div className="max-w-xl mx-auto">
      <Link to={directoryHref} className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6">
        <ChevronLeft size={16} />
        {directoryLabel}
      </Link>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Banner */}
        <div
          className="h-32 relative overflow-hidden"
          style={{
            background: `
              radial-gradient(ellipse 70% 120% at 80% 10%, rgba(74,124,47,0.7) 0%, transparent 60%),
              radial-gradient(ellipse 50% 100% at 10% 90%, rgba(45,80,22,0.5) 0%, transparent 50%),
              linear-gradient(155deg, #2D5016 0%, #3A6B1E 40%, #4A7C2F 70%, #3A6B1E 100%)
            `,
          }}
        >
          <div className="absolute top-[-30%] right-[8%] w-24 h-24 rounded-full opacity-[0.12] border border-white/20"
            style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
          <div className="absolute top-[-10%] right-[30%] w-14 h-14 rounded-full opacity-[0.09] border border-white/10"
            style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
          <div className="absolute bottom-[-20%] left-[15%] w-20 h-20 rounded-full opacity-[0.08] border border-white/10"
            style={{ background: 'radial-gradient(circle at 40% 30%, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />
        </div>

        <div className="px-6 pb-6 relative">
          {/* Avatar + name */}
          <div className="-mt-8 mb-5 flex items-end gap-4">
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
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">
                  <User size={11} />
                  {ROLE_LABELS[person.role]}
                </span>
                {/* Audit M9 — viewer-side: hide grade unless the student
                    opted in. A student viewing their own profile sees their
                    grade either way (handled by the `isSelf` checks below). */}
                {person.grade && person.share_grade_with_employers && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-border text-ink-secondary text-xs font-medium">
                    {person.grade}
                  </span>
                )}
                {isEM && person.open_to_mentorship && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success-bg text-success text-xs font-medium">
                    <Heart size={11} />
                    Open to mentorship
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
              {person.graduation_year && (
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">
                    {person.role === 'student' ? 'Graduating' : 'Graduated'}
                  </span>
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

            {/* Available slots + meeting request (EM only, viewed by student).
                Audit task 9 — hide the section entirely when the mentor has
                no published slots so the student isn't dead-ended at "No
                upcoming availability posted." (Message <name> stays as the
                fallback path.) */}
            {isEM && !isSelf && myProfile?.role === 'student' && person.open_to_mentorship && (slots.length > 0 || meetingSuccess) && (
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

            {/* Message / Edit buttons */}
            {!isSelf && (
              <button type="button"
                onClick={openConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                  border border-border text-sm font-medium text-ink-secondary
                  hover:bg-primary-faint hover:text-ink transition-colors"
              >
                <MessageSquare size={15} />
                Message {person.full_name.trim().split(/\s+/)[0] || 'this person'}
              </button>
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
