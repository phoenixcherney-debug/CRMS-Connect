import { useState, useEffect } from 'react'
import type React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  CheckCircle2, AlertCircle, User, Pencil, X, Plus, Trash2, Briefcase, Heart, Upload,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  ROLE_LABELS, INDUSTRY_OPTIONS, WEEKLY_AVAILABILITY_OPTIONS, INTEREST_OPTIONS,
  STUDENT_GRADES, MENTOR_TYPE_LABELS, STUDENT_SEEKING_LABELS, STUDENT_SEEKING_PUBLIC,
} from '../types'
import type { CareerHistory, MentorType, StudentSeeking } from '../types'
import Spinner from '../components/Spinner'
import { useToast } from '../components/ToastProvider'
import { validateDisplayName } from '../lib/nameFilter'
import { formatDisplayName } from '../lib/displayName'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { initialsOf } from '../lib/initials'

export default function Profile() {
  const { profile, user, refreshProfile, loading } = useAuth()
  const toast = useToast()
  const { pathname } = useLocation()
  // Audit task 23 — /profile/edit opens the form by default.
  const [editing, setEditing] = useState(pathname === '/profile/edit')

  const [fullName, setFullName]                     = useState('')
  const [bio, setBio]                               = useState('')
  const [graduationYear, setGraduationYear]         = useState('')
  const [avatarUrl, setAvatarUrl]                   = useState('')
  const [company, setCompany]                       = useState('')
  const [industry, setIndustry]                     = useState('')
  const [industryOther, setIndustryOther]           = useState('')
  const [openToMentorship, setOpenToMentorship]     = useState(false)
  const [meetingRequestMode, setMeetingRequestMode] = useState<'flexible' | 'slots'>('flexible')
  // P1-10 — empty string means "not paused".
  const [mentorshipPausedUntil, setMentorshipPausedUntil] = useState('')
  const [interests, setInterests]                   = useState<string[]>([])
  const [weeklyAvailability, setWeeklyAvailability] = useState('')

  // Sub-role fields
  const [mentorType, setMentorType]               = useState<MentorType | ''>('')
  const [mentorTypeOther, setMentorTypeOther]     = useState('')
  const [studentSeeking, setStudentSeeking]       = useState<StudentSeeking | ''>('')
  const [studentSeekingOther, setStudentSeekingOther] = useState('')
  const [grade, setGrade]                         = useState('')
  const [shareGradeWithEmployers, setShareGradeWithEmployers] = useState(false)

  // Career history
  const [careerHistory, setCareerHistory] = useState<CareerHistory[]>([])
  const [careerLoading, setCareerLoading] = useState(false)
  const [newEntry, setNewEntry] = useState({ company: '', title: '', start_year: '', end_year: '', is_current: false })
  const [addingEntry, setAddingEntry] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const [saving, setSaving]               = useState(false)
  const [saveSuccess, setSaveSuccess]     = useState(false)
  const [saveError, setSaveError]         = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)

  const isEmployerMentor = profile?.role === 'employer_mentor'
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications()
  const [pushLoading, setPushLoading] = useState(false)
  // avatarBroken used to live below the early returns, which violated the
  // rules of hooks (rendered more hooks than the previous render → React
  // error #310). Pulled it up here so every hook runs unconditionally.
  const [avatarBroken, setAvatarBroken] = useState(false)
  // Reset when the preview source changes — derived from `editing`,
  // `avatarUrl`, and the persisted profile avatar.
  useEffect(() => {
    setAvatarBroken(false)
  }, [editing, avatarUrl, profile?.avatar_url])

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setBio(profile.bio ?? '')
      setGraduationYear(profile.graduation_year?.toString() ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
      setCompany(profile.company ?? '')
      const savedIndustry = profile.industry ?? ''
      const isCustomIndustry = savedIndustry !== '' && !(INDUSTRY_OPTIONS as readonly string[]).includes(savedIndustry)
      setIndustry(isCustomIndustry ? 'Other' : savedIndustry)
      setIndustryOther(isCustomIndustry ? savedIndustry : '')
      setOpenToMentorship(profile.open_to_mentorship ?? false)
      setMeetingRequestMode((profile.meeting_request_mode as 'flexible' | 'slots' | null | undefined) ?? 'flexible')
      setMentorshipPausedUntil((profile.mentorship_paused_until as string | null | undefined) ?? '')
      setInterests(profile.interests ?? [])
      setWeeklyAvailability(profile.weekly_availability ?? '')
      setMentorType(profile.mentor_type ?? '')
      setMentorTypeOther(profile.mentor_type_other ?? '')
      setStudentSeeking(profile.student_seeking ?? '')
      setStudentSeekingOther(profile.student_seeking_other ?? '')
      setGrade(profile.grade ?? '')
      setShareGradeWithEmployers(profile.share_grade_with_employers ?? false)
    }
  }, [profile?.id])

  // Load career history for employer/mentors
  useEffect(() => {
    if (!profile || !isEmployerMentor) return
    async function loadCareer() {
      setCareerLoading(true)
      const { data } = await supabase
        .from('career_history')
        .select('*')
        .eq('profile_id', profile!.id)
        .order('is_current', { ascending: false })
        .order('start_year', { ascending: false })
      setCareerHistory((data as CareerHistory[]) ?? [])
      setCareerLoading(false)
    }
    loadCareer()
  }, [profile?.id, isEmployerMentor])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface rounded-2xl border border-border p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
          <AlertCircle size={32} className="text-error mx-auto mb-3" />
          <p className="text-ink font-medium mb-1">Could not load profile</p>
          <p className="text-sm text-ink-secondary">There was a problem fetching your profile. Try refreshing the page.</p>
        </div>
      </div>
    )
  }

  const initials = initialsOf(profile.full_name)

  function handleCancel() {
    setFullName(profile!.full_name ?? '')
    setBio(profile!.bio ?? '')
    setGraduationYear(profile!.graduation_year?.toString() ?? '')
    setAvatarUrl(profile!.avatar_url ?? '')
    setCompany(profile!.company ?? '')
    const savedIndustry = profile!.industry ?? ''
    const isCustomIndustry = savedIndustry !== '' && !(INDUSTRY_OPTIONS as readonly string[]).includes(savedIndustry)
    setIndustry(isCustomIndustry ? 'Other' : savedIndustry)
    setIndustryOther(isCustomIndustry ? savedIndustry : '')
    setOpenToMentorship(profile!.open_to_mentorship ?? false)
    setInterests(profile!.interests ?? [])
    setWeeklyAvailability(profile!.weekly_availability ?? '')
    setMentorType(profile!.mentor_type ?? '')
    setMentorTypeOther(profile!.mentor_type_other ?? '')
    setStudentSeeking(profile!.student_seeking ?? '')
    setStudentSeekingOther(profile!.student_seeking_other ?? '')
    setGrade(profile!.grade ?? '')
    setShareGradeWithEmployers(profile!.share_grade_with_employers ?? false)
    setSaveError(null)
    setEditing(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setAvatarUploadError(null)
    // S5.6 — client-side size cap. Storage bucket has its own limit but
    // we want a friendly error before the round-trip.
    const MAX_BYTES = 5 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      setAvatarUploadError('Photo must be 5 MB or less.')
      e.target.value = ''
      return
    }
    if (!file.type.startsWith('image/')) {
      setAvatarUploadError('Please pick an image file.')
      e.target.value = ''
      return
    }
    setAvatarUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${profile.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      setAvatarUploadError('Upload failed — please try again or paste a URL below.')
      setAvatarUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(publicUrl)
    setAvatarUploading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)

    const trimmedName = fullName.trim()
    if (!trimmedName) {
      setSaveError('Please enter your name.')
      return
    }
    if (trimmedName.length > 80) {
      setSaveError('Name must be 80 characters or fewer.')
      return
    }
    // SEC-003 — moderation runs on every save, not just on signup.
    const nameCheck = validateDisplayName(trimmedName)
    if (!nameCheck.ok) {
      setSaveError(nameCheck.reason ?? 'That display name isn\'t allowed.')
      return
    }

    // Match the server-side CHECK constraints in migration 023:
    //   year >= currentYear - 80 AND year <= currentYear + 8
    // Students see a tighter range — "expected graduation" only makes sense
    // for current/future cohorts, while alumni in EM accounts can be far back.
    const currentYear = new Date().getFullYear()
    const minYr = profile?.role === 'student' ? currentYear - 1 : currentYear - 80
    const maxYr = currentYear + 8
    const yr = graduationYear ? parseInt(graduationYear, 10) : NaN
    if (graduationYear && (isNaN(yr) || yr < minYr || yr > maxYr)) {
      setSaveError(`Graduation year must be between ${minYr} and ${maxYr}.`)
      return
    }

    // Audit M5 — company is required for employer/mentor profiles. Catches
    // pre-existing rows whose company was never filled (the field used to
    // be optional in onboarding) and prevents the user from saving over a
    // populated company with empty.
    if (isEmployerMentor && !company.trim()) {
      setSaveError('Please enter a company or organization name.')
      return
    }

    setSaving(true)

    const updates: Record<string, unknown> = {
      full_name: formatDisplayName(trimmedName),
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      graduation_year: isNaN(yr) ? null : yr,
    }

    if (isEmployerMentor) {
      updates.company          = company.trim() || null
      updates.industry         = industry === 'Other' ? (industryOther.trim() || null) : (industry || null)
      updates.open_to_mentorship = openToMentorship
      updates.meeting_request_mode = meetingRequestMode
      updates.mentorship_paused_until = mentorshipPausedUntil || null
      updates.mentor_type      = mentorType || null
      updates.mentor_type_other = mentorType === 'other' ? mentorTypeOther.trim() || null : null
    }

    if (profile?.role === 'student') {
      updates.interests           = interests
      updates.weekly_availability = weeklyAvailability || null
      updates.student_seeking     = studentSeeking || null
      updates.student_seeking_other = studentSeeking === 'other' ? studentSeekingOther.trim() || null : null
      updates.grade               = grade || null
      updates.share_grade_with_employers = shareGradeWithEmployers
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', profile!.id)

    setSaving(false)
    if (error) {
      setSaveError(error.message)
      toast('Could not save your profile.', { kind: 'error' })
    } else {
      await refreshProfile()
      setEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      toast('Saved.')
    }
  }

  async function handleAddCareerEntry() {
    if (!newEntry.company.trim() || !newEntry.title.trim() || !newEntry.start_year) return
    setAddingEntry(true)
    const startYr = parseInt(newEntry.start_year)
    const endYr   = newEntry.end_year ? parseInt(newEntry.end_year) : null

    const { data, error } = await supabase
      .from('career_history')
      .insert({
        profile_id: profile!.id,
        company:    newEntry.company.trim(),
        title:      newEntry.title.trim(),
        start_year: startYr,
        end_year:   newEntry.is_current ? null : endYr,
        is_current: newEntry.is_current,
      })
      .select()
      .single()

    setAddingEntry(false)
    if (!error && data) {
      setCareerHistory((prev) => [data as CareerHistory, ...prev])
      setNewEntry({ company: '', title: '', start_year: '', end_year: '', is_current: false })
      setShowAddForm(false)
    }
  }

  async function handleDeleteCareerEntry(entryId: string) {
    const { error } = await supabase.from('career_history').delete().eq('id', entryId)
    if (!error) setCareerHistory((prev) => prev.filter((e) => e.id !== entryId))
  }

  const previewAvatarUrl = editing ? avatarUrl : (profile.avatar_url ?? '')

  // Sub-role display labels
  const mentorTypeLabel = profile.mentor_type === 'other'
    ? (profile.mentor_type_other || 'Other')
    : profile.mentor_type ? MENTOR_TYPE_LABELS[profile.mentor_type] : null
  // P1-8 — use the spelled-out public phrasing for the own-profile
  // display so it matches what other viewers see.
  const studentSeekingLabel = profile.student_seeking === 'other'
    ? (profile.student_seeking_other || STUDENT_SEEKING_PUBLIC.other)
    : profile.student_seeking ? STUDENT_SEEKING_PUBLIC[profile.student_seeking] : null

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Profile</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {editing ? 'Update your account details' : 'Your account details'}
          </p>
        </div>
        {!editing && (
          <button type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border
              text-ink-secondary hover:text-ink hover:border-border-strong hover:bg-primary-faint
              text-sm font-medium transition-colors"
          >
            <Pencil size={14} />
            Edit
          </button>
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* M-04 — replaced the empty 128px gradient banner with a 4px
            accent bar. We don't support cover-image upload yet, so the
            tall banner was just empty negative space. */}
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
              {previewAvatarUrl && !avatarBroken ? (
                <img src={previewAvatarUrl} alt={profile.full_name} className="w-full h-full object-cover" onError={() => setAvatarBroken(true)} />
              ) : (
                <span className="text-primary font-bold text-xl">{initials}</span>
              )}
            </div>
            <div className="pb-1">
              <p className="font-semibold text-ink">{profile.full_name}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">
                  <User size={11} />
                  {ROLE_LABELS[profile.role]}
                </span>
                {isEmployerMentor && profile.open_to_mentorship && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success-bg text-success text-xs font-medium">
                    <Heart size={11} />
                    Open to mentorship
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── VIEW MODE ── */}
          {!editing && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-primary-faint border border-border text-sm space-y-1.5">
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Email</span>
                  <span className="text-ink-secondary">{user?.email}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium text-ink w-28 shrink-0">Member since</span>
                  <span className="text-ink-secondary">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
                {profile.role === 'student' && profile.grade && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Grade</span>
                    <span className="text-ink-secondary">{profile.grade}</span>
                  </div>
                )}
                {profile.graduation_year && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Class of</span>
                    <span className="text-ink-secondary">{profile.graduation_year}</span>
                  </div>
                )}
                {profile.role === 'student' && studentSeekingLabel && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Looking for</span>
                    <span className="text-ink-secondary">{studentSeekingLabel}</span>
                  </div>
                )}
                {isEmployerMentor && profile.company && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Company</span>
                    <span className="text-ink-secondary">{profile.company}</span>
                  </div>
                )}
                {isEmployerMentor && profile.industry && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Industry</span>
                    <span className="text-ink-secondary">{profile.industry}</span>
                  </div>
                )}
                {isEmployerMentor && mentorTypeLabel && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Role</span>
                    <span className="text-ink-secondary">{mentorTypeLabel}</span>
                  </div>
                )}
                {profile.weekly_availability && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Availability</span>
                    <span className="text-ink-secondary">{profile.weekly_availability}</span>
                  </div>
                )}
              </div>

              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-ink mb-1.5">Interests</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map((interest) => (
                      <span key={interest} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary-muted text-primary border border-primary-muted">
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {profile.bio ? (
                <div>
                  <p className="text-sm font-medium text-ink mb-1.5">Bio</p>
                  <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
                </div>
              ) : (
                // L-09 — standardized empty-state phrasing across bio + career.
                <p className="text-sm text-ink-muted italic">
                  No bio yet —{' '}
                  <button type="button" onClick={() => setEditing(true)} className="text-primary hover:underline not-italic font-medium">
                    + Add bio
                  </button>
                </p>
              )}

              {/* Career History (view mode, employer/mentor only) */}
              {isEmployerMentor && (
                <div>
                  <p className="text-sm font-medium text-ink mb-2 flex items-center gap-1.5">
                    <Briefcase size={14} className="text-ink-muted" />
                    Career History
                  </p>
                  {careerLoading ? (
                    <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                  ) : careerHistory.length === 0 ? (
                    // L-08/L-09 — inline action so the user doesn't have to
                    // hunt for the Edit button at the top of the page.
                    <p className="text-sm text-ink-muted italic">
                      No career history yet —{' '}
                      <button type="button" onClick={() => setEditing(true)} className="text-primary hover:underline not-italic font-medium">
                        + Add position
                      </button>
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {careerHistory.map((entry) => (
                        <div key={entry.id} className="p-3 rounded-lg bg-primary-faint border border-border text-sm">
                          <p className="font-medium text-ink">{entry.title}</p>
                          <p className="text-ink-secondary">{entry.company} · {entry.start_year}–{entry.is_current ? 'Present' : entry.end_year ?? ''}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Push notifications toggle */}
              {permission !== 'unsupported' && permission !== 'loading' && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-primary-faint">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">Push notifications</p>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {permission === 'denied'
                        ? 'Blocked in browser settings — allow notifications to enable.'
                        : isSubscribed
                        ? 'You\'ll be notified about new messages and updates.'
                        : 'Get notified about new messages and activity.'
                      }
                    </p>
                  </div>
                  {permission !== 'denied' && (
                    <button
                      type="button"
                      disabled={pushLoading}
                      onClick={async () => {
                        setPushLoading(true)
                        if (isSubscribed) { await unsubscribe() } else { await subscribe() }
                        setPushLoading(false)
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ml-3
                        ${isSubscribed ? 'bg-primary' : 'bg-border-strong'} disabled:opacity-50`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform
                        ${isSubscribed ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  )}
                </div>
              )}

              {/* P1-12 — per-category preferences live on /settings/notifications. */}
              {permission !== 'unsupported' && permission !== 'loading' && (
                <Link
                  to="/settings/notifications"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Customize what triggers a push →
                </Link>
              )}

              {saveSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-success-bg border border-status-accepted-border px-4 py-3">
                  <CheckCircle2 size={16} className="text-success" />
                  <p className="text-sm text-success font-medium">Profile saved!</p>
                </div>
              )}

              {/* P3-43 / P3-44 — change password & update email */}
              <AccountSecuritySection />

              {/* Danger zone — delete account */}
              <DeleteAccountSection />
            </div>
          )}

          {/* ── EDIT MODE ── */}
          {editing && (
            <>
              {saveError && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-error-bg border border-status-rejected-border px-4 py-3">
                  <AlertCircle size={15} className="text-error shrink-0 mt-0.5" />
                  <p className="text-sm text-error">{saveError}</p>
                </div>
              )}

              <div className="mb-5 p-3 rounded-lg bg-primary-faint border border-border text-sm">
                <p className="text-ink-secondary">
                  <span className="font-medium text-ink">Email:</span> {user?.email}
                </p>
                <p className="text-ink-secondary mt-1">
                  <span className="font-medium text-ink">Member since:</span>{' '}
                  {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Full name */}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Full name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Grade (students only) */}
                {profile.role === 'student' && (
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1.5">
                      Grade <span className="text-ink-muted font-normal">(optional)</span>
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    >
                      <option value="">Select grade…</option>
                      {STUDENT_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {/* A.1 — always render so the privacy choice exists even
                        before grade is set. Now also gates Class-of-YYYY
                        on viewer-side rendering, not just the grade chip. */}
                    <label className="flex items-start gap-2 mt-2 text-xs text-ink-secondary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={shareGradeWithEmployers}
                        onChange={(e) => setShareGradeWithEmployers(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                      />
                      <span>
                        Share my grade and class year with employers and mentors
                        <span className="block text-ink-muted">
                          Off by default. School staff always see your grade.
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {/* Graduation year */}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    {profile.role === 'student' ? 'Graduation year' : 'Graduation year (alumni)'}{' '}
                    <span className="text-ink-muted font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    /* Students: tight bounds (expected graduation is forward-
                       leaning). Alumni in EM accounts: keep DB-wide range
                       [currentYear − 80, currentYear + 8] from migration 023. */
                    min={profile.role === 'student'
                      ? new Date().getFullYear() - 1
                      : new Date().getFullYear() - 80}
                    max={new Date().getFullYear() + 8}
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(e.target.value)}
                    placeholder={profile.role === 'student' ? 'e.g. 2026' : 'e.g. 2015'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Student-only fields */}
                {profile.role === 'student' && (
                  <>
                    {/* What they're seeking */}
                    <div>
                      <label className="block text-sm font-medium text-ink mb-2">
                        Looking for <span className="text-ink-muted font-normal">(optional)</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(STUDENT_SEEKING_LABELS) as [StudentSeeking, string][]).map(([val, label]) => (
                          <button type="button"
                            key={val}
                            onClick={() => setStudentSeeking(val === studentSeeking ? '' : val)}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                              ${studentSeeking === val
                                ? 'border-primary text-primary'
                                : 'border-border text-ink-secondary hover:border-border-strong hover:bg-primary-faint'
                              }`}
                            style={studentSeeking === val ? { backgroundColor: 'var(--color-primary-muted)' } : {}}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {studentSeeking === 'other' && (
                        <input
                          type="text"
                          value={studentSeekingOther}
                          onChange={(e) => setStudentSeekingOther(e.target.value)}
                          placeholder="Please describe…"
                          className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                            placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                      )}
                    </div>

                    {/* Weekly availability */}
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        Weekly availability <span className="text-ink-muted font-normal">(optional)</span>
                      </label>
                      <select
                        value={weeklyAvailability}
                        onChange={(e) => setWeeklyAvailability(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      >
                        <option value="">Select availability…</option>
                        {WEEKLY_AVAILABILITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    {/* Interests */}
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        Areas of interest <span className="text-ink-muted font-normal">(optional — select all that apply)</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {INTEREST_OPTIONS.map((opt) => {
                          const selected = interests.includes(opt)
                          return (
                            <button type="button"
                              key={opt}
                              onClick={() => setInterests((prev) => selected ? prev.filter((i) => i !== opt) : [...prev, opt])}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                                selected
                                  ? 'bg-primary text-white border-primary'
                                  : 'bg-surface text-ink-secondary border-border hover:border-primary hover:text-ink'
                              }`}
                            >
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Employer/Mentor-only fields */}
                {isEmployerMentor && (
                  <>
                    {/* Mentor type */}
                    <div>
                      <label className="block text-sm font-medium text-ink mb-2">
                        I am joining as a… <span className="text-ink-muted font-normal">(optional)</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(MENTOR_TYPE_LABELS) as [MentorType, string][]).map(([val, label]) => (
                          <button type="button"
                            key={val}
                            onClick={() => setMentorType(val === mentorType ? '' : val)}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors
                              ${mentorType === val
                                ? 'border-primary text-primary'
                                : 'border-border text-ink-secondary hover:border-border-strong hover:bg-primary-faint'
                              }`}
                            style={mentorType === val ? { backgroundColor: 'var(--color-primary-muted)' } : {}}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {mentorType === 'other' && (
                        <input
                          type="text"
                          value={mentorTypeOther}
                          onChange={(e) => setMentorTypeOther(e.target.value)}
                          placeholder="Please describe…"
                          className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                            placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        Company / Organization <span className="text-error">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Where do you work?"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                          placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        Industry / Area of expertise <span className="text-ink-muted font-normal">(optional)</span>
                      </label>
                      <select
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      >
                        <option value="">Select an industry…</option>
                        {INDUSTRY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      {industry === 'Other' && (
                        <input
                          type="text"
                          value={industryOther}
                          onChange={(e) => setIndustryOther(e.target.value)}
                          placeholder="Please describe your industry…"
                          className="mt-2 w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                            placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                      )}
                    </div>

                    {/* Weekly availability */}
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        Weekly availability <span className="text-ink-muted font-normal">(optional)</span>
                      </label>
                      <select
                        value={weeklyAvailability}
                        onChange={(e) => setWeeklyAvailability(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      >
                        <option value="">Select availability…</option>
                        {WEEKLY_AVAILABILITY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-primary-faint">
                      <div>
                        <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                          <Heart size={14} className="text-primary" />
                          Open to mentorship
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5">
                          Students will see that you're available for mentorship conversations
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // P1-10 — toast + deep link the moment the toggle flips on,
                          // so the mentor sees the proof their card landed.
                          const next = !openToMentorship
                          setOpenToMentorship(next)
                          if (next) {
                            toast(
                              (
                                <span>
                                  You're now visible.{' '}
                                  <Link to="/mentors" className="font-semibold underline">View your mentor card →</Link>
                                </span>
                              ) as unknown as string,
                            )
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors
                          ${openToMentorship ? 'bg-primary' : 'bg-border-strong'}`}
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform
                          ${openToMentorship ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>

                    {/* P1-10 — pause-until: a mentor going on parental leave or
                        a busy season can suspend without remembering to flip
                        the toggle back on. Only visible when toggle is on. */}
                    {openToMentorship && (
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-primary-faint">
                        <label className="text-sm text-ink flex-1">
                          <span className="font-medium">Pause until</span>
                          <span className="block text-xs text-ink-muted mt-0.5">
                            Optional. Hides you from /mentors until this date passes; the toggle stays on.
                          </span>
                        </label>
                        <input
                          type="date"
                          value={mentorshipPausedUntil}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setMentorshipPausedUntil(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-ink text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        {mentorshipPausedUntil && (
                          <button
                            type="button"
                            onClick={() => setMentorshipPausedUntil('')}
                            className="text-xs text-ink-muted hover:text-ink"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    )}

                    {/* P2-14 — pick how students should propose meeting times. */}
                    {openToMentorship && (
                      <div className="p-3 rounded-lg border border-border bg-primary-faint space-y-2">
                        <p className="text-sm font-medium text-ink">How would you like to be contacted?</p>
                        {[
                          { value: 'flexible', label: 'Anytime — students can propose a time', sub: 'No calendar required. They pick a date+time and you accept or counter.' },
                          { value: 'slots',    label: 'Only during my listed availability slots', sub: 'You publish slots on the Availability page; students pick one.' },
                        ].map((opt) => (
                          <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="meeting_request_mode"
                              checked={meetingRequestMode === opt.value}
                              onChange={() => setMeetingRequestMode(opt.value as 'flexible' | 'slots')}
                              className="mt-1 text-primary focus:ring-primary/30"
                            />
                            <span className="text-sm">
                              <span className="font-medium text-ink">{opt.label}</span>
                              <span className="block text-xs text-ink-muted mt-0.5">{opt.sub}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Bio <span className="text-ink-muted font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell others a bit about yourself, your background, or what you do…"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder resize-none
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                {/* Profile photo */}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Profile photo <span className="text-ink-muted font-normal">(optional)</span>
                  </label>

                  {/* Preview */}
                  {avatarUrl && !avatarBroken && (
                    <div className="mb-2 flex items-center gap-3">
                      <img
                        src={avatarUrl}
                        alt="Preview"
                        className="w-12 h-12 rounded-xl object-cover border border-border"
                        onError={() => setAvatarBroken(true)}
                      />
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="text-xs text-error hover:text-error/80 font-medium"
                      >
                        Remove photo
                      </button>
                    </div>
                  )}

                  {/* File upload */}
                  <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border
                    bg-primary-faint hover:bg-primary-faint/80 cursor-pointer text-sm text-ink-secondary
                    transition-colors">
                    {avatarUploading
                      ? <><Spinner size="sm" /> Uploading…</>
                      : <><Upload size={15} /> Upload a photo</>
                    }
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={avatarUploading}
                      onChange={handleAvatarUpload}
                    />
                  </label>

                  {avatarUploadError && (
                    <p className="mt-1 text-xs text-error">{avatarUploadError}</p>
                  )}
                  {/* Audit task 22 — single canonical input (file upload).
                      The previous "Or paste a URL" field made it unclear
                      which one wins when both were filled. Removed; the
                      file upload writes the resulting public URL into
                      avatar_url directly. */}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" disabled={saving || !fullName.trim()} className="btn-gold px-5 py-2.5">
                    {saving && <Spinner size="sm" className="border-white/30 border-t-white" />}
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border
                      text-ink-secondary hover:text-ink hover:border-border-strong
                      text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              </form>

              {/* Career History management (edit mode, employer/mentor only) */}
              {isEmployerMentor && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                      <Briefcase size={14} className="text-ink-muted" />
                      Career History
                    </p>
                    {!showAddForm && (
                      <button type="button" onClick={() => setShowAddForm(true)} className="flex items-center gap-1 text-xs text-primary hover:text-primary-light font-medium">
                        <Plus size={13} /> Add position
                      </button>
                    )}
                  </div>

                  {showAddForm && (
                    <div className="p-4 rounded-lg border border-primary-muted bg-primary-faint space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Job title"
                          value={newEntry.title}
                          onChange={(e) => setNewEntry((n) => ({ ...n, title: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder
                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                        <input
                          type="text"
                          placeholder="Company"
                          value={newEntry.company}
                          onChange={(e) => setNewEntry((n) => ({ ...n, company: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder
                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          placeholder="Start year"
                          min="1960"
                          max="2040"
                          value={newEntry.start_year}
                          onChange={(e) => setNewEntry((n) => ({ ...n, start_year: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder
                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                        <input
                          type="number"
                          placeholder="End year"
                          min="1960"
                          max="2040"
                          value={newEntry.end_year}
                          disabled={newEntry.is_current}
                          onChange={(e) => setNewEntry((n) => ({ ...n, end_year: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder
                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors disabled:opacity-50"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newEntry.is_current}
                          onChange={(e) => setNewEntry((n) => ({ ...n, is_current: e.target.checked, end_year: '' }))}
                          className="rounded border-border text-primary focus:ring-primary/30"
                        />
                        I currently work here
                      </label>
                      <div className="flex gap-2">
                        <button type="button"
                          onClick={handleAddCareerEntry}
                          disabled={addingEntry || !newEntry.title.trim() || !newEntry.company.trim() || !newEntry.start_year}
                          className="btn-gold"
                        >
                          {addingEntry ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Plus size={14} />}
                          {addingEntry ? 'Adding…' : 'Add'}
                        </button>
                        <button type="button"
                          onClick={() => { setShowAddForm(false); setNewEntry({ company: '', title: '', start_year: '', end_year: '', is_current: false }) }}
                          className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {careerHistory.length === 0 && !showAddForm ? (
                    <p className="text-sm text-ink-muted italic">No career history yet. Click "Add position" to get started.</p>
                  ) : (
                    <div className="space-y-2">
                      {careerHistory.map((entry) => (
                        <div key={entry.id} className="p-3 rounded-lg bg-primary-faint border border-border text-sm flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink">{entry.title}</p>
                            <p className="text-ink-secondary">{entry.company} · {entry.start_year}–{entry.is_current ? 'Present' : entry.end_year ?? ''}</p>
                          </div>
                          <button type="button"
                            onClick={() => handleDeleteCareerEntry(entry.id)}
                            className="text-ink-muted hover:text-error transition-colors shrink-0 mt-0.5"
                            title="Remove this position"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Account & security section ──────────────────────────────────────────────
// P3-43: change password (current password re-entry, then supabase.auth.updateUser).
// (P3-44 update-email flow was removed — Supabase's email-change path
//  inherently uses verification links, which we no longer rely on.)
function AccountSecuritySection() {
  const { user } = useAuth()
  const [openPwd, setOpenPwd]     = useState(false)

  // Password change state
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdSaving, setPwdSaving]   = useState(false)
  const [pwdError, setPwdError]     = useState<string | null>(null)
  const [pwdSuccess, setPwdSuccess] = useState(false)

  if (!user) return null
  const currentEmail = user.email ?? ''

  const newPwdOk = newPwd.length >= 8 && /[A-Za-z]/.test(newPwd) && /[0-9]/.test(newPwd)
  const confirmOk = confirmPwd.length > 0 && newPwd === confirmPwd

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    setPwdSuccess(false)
    if (!newPwdOk) {
      setPwdError('New password must be at least 8 characters and include a letter and a number.')
      return
    }
    if (!confirmOk) {
      setPwdError("Passwords don't match.")
      return
    }
    setPwdSaving(true)
    // Re-auth with the current password so we don't let a hijacked session
    // change credentials silently.
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPwd,
    })
    if (reauthErr) {
      setPwdSaving(false)
      setPwdError('Current password is incorrect.')
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setPwdSaving(false)
    if (error) {
      setPwdError(error.message)
      return
    }
    setPwdSuccess(true)
    setCurrentPwd('')
    setNewPwd('')
    setConfirmPwd('')
  }

  return (
    <div className="mt-6 pt-6 border-t border-border space-y-4">
      <p className="text-sm font-semibold text-ink">Account & security</p>

      {/* Change password */}
      <div>
        {!openPwd ? (
          <button
            type="button"
            onClick={() => { setOpenPwd(true); setPwdError(null); setPwdSuccess(false) }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Change password…
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="p-4 rounded-lg border border-border bg-primary-faint space-y-3">
            <p className="text-sm font-medium text-ink">Change password</p>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              required
            />
            <p className="text-xs text-ink-muted">
              At least 8 characters, including a letter and a number.
            </p>
            {pwdError && <p className="text-xs text-error">{pwdError}</p>}
            {pwdSuccess && <p className="text-xs text-success">Password updated.</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pwdSaving || !currentPwd || !newPwdOk || !confirmOk}
                className="btn-gold px-4 py-2"
              >
                {pwdSaving && <Spinner size="sm" className="border-white/30 border-t-white" />}
                {pwdSaving ? 'Saving…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenPwd(false)
                  setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
                  setPwdError(null); setPwdSuccess(false)
                }}
                disabled={pwdSaving}
                className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  )
}

// ─── Delete account section ───────────────────────────────────────────────────
// Soft-delete: anonymize personal fields and set banned_at so the user is
// hidden from public listings (RLS migration 030) and redirected to /banned
// on any future sign-in. We can't unconditionally remove the Supabase auth
// user from the client (requires service role); the registrar handles full
// auth-user purges via mailto on the privacy page.
function DeleteAccountSection() {
  const { profile, user, signOut } = useAuth()
  const [open, setOpen]             = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)

  if (!profile || !user) return null

  const expectedEmail = (user.email ?? '').trim().toLowerCase()
  const matches = confirmEmail.trim().toLowerCase() === expectedEmail && expectedEmail.length > 0

  async function handleDelete() {
    if (!matches || !profile) return
    setSubmitting(true)
    setErrorMsg(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: 'Deleted user',
        avatar_url: null,
        bio: null,
        company: null,
        industry: null,
        interests: [],
        weekly_availability: null,
        mentor_type: null,
        mentor_type_other: null,
        student_seeking: null,
        student_seeking_other: null,
        grade: null,
        graduation_year: null,
        open_to_mentorship: false,
        banned_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (error) {
      setSubmitting(false)
      setErrorMsg('Could not delete the account. Please email registrar@crms.org for help.')
      return
    }

    // Best-effort audit notice — not a real email send (that needs an edge
    // function) but it opens the registrar's mail client so deletions are
    // traceable until a server-side audit log is wired up.
    try {
      const subject = encodeURIComponent('CRMS Connect — account deletion')
      const body    = encodeURIComponent(`User ${expectedEmail} requested account deletion at ${new Date().toISOString()}.`)
      window.open(`mailto:registrar@crms.org?subject=${subject}&body=${body}`, '_blank', 'noopener')
    } catch { /* ignore */ }

    await signOut()
    // Hard reload so banned_at picks up server-side and the public
    // landing renders cleanly without any cached authenticated chunks.
    window.location.href = '/'
  }

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <p className="text-sm font-semibold text-ink mb-1">Delete account</p>
      <p className="text-xs text-ink-muted mb-3">
        Permanently removes your name, bio, and other personal details, and
        hides you from the directory. Your applications and posts remain
        attributed to "Deleted user" so employers' records aren't disrupted.
      </p>
      <button
        type="button"
        onClick={() => { setOpen(true); setConfirmEmail(''); setErrorMsg(null) }}
        className="text-xs font-medium text-error hover:underline"
      >
        Delete my account…
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <h3 className="text-base font-semibold text-ink mb-2">Delete your account?</h3>
            <ul className="text-sm text-ink-secondary list-disc pl-5 space-y-1 mb-4">
              <li>Your profile will be anonymized and hidden from the directory.</li>
              <li>You will be signed out and unable to sign back in.</li>
              <li>Past applications and messages remain visible to recipients but attributed to "Deleted user".</li>
              <li>For a full data export or auth-record purge, email registrar@crms.org.</li>
            </ul>
            <label className="block text-xs font-medium text-ink mb-1.5">
              Type your email address ({expectedEmail}) to confirm
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={expectedEmail}
              autoComplete="off"
              className="w-full mb-3 px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            {errorMsg && (
              <p className="text-xs text-error mb-3">{errorMsg}</p>
            )}
            <div className="flex gap-3">
              <button type="button"
                onClick={handleDelete}
                disabled={!matches || submitting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-error hover:bg-error/90 text-white font-medium text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
