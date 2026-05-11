import { useState, useEffect } from 'react'
import type React from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Sparkles, Building2, Layers, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  INDUSTRY_OPTIONS, INTEREST_OPTIONS,
  MENTOR_TYPE_LABELS, STUDENT_SEEKING_LABELS, STUDENT_GRADES,
  WEEKLY_AVAILABILITY_OPTIONS,
} from '../types'
import type { MentorType, StudentSeeking, StudentGrade } from '../types'
import { containsBlockedTerms } from '../lib/textFilter'
import Spinner from '../components/Spinner'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

const ROLE_WELCOME: Record<string, { headline: string; sub: string }> = {
  student: {
    headline: 'Welcome to CRMS Connect!',
    sub: 'Discover internships, opportunities, and mentors posted by CRMS employers and mentors.',
  },
  employer_mentor: {
    headline: 'Welcome to CRMS Connect!',
    sub: 'Share opportunities from your network and connect with current CRMS students.',
  },
}

const MENTOR_TYPES: MentorType[] = ['employer', 'mentor', 'both', 'other']
const STUDENT_SEEKINGS: StudentSeeking[] = ['job', 'mentor', 'both', 'other']

export default function Onboarding() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [bio, setBio] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [grade, setGrade] = useState<StudentGrade | ''>('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [company, setCompany] = useState('')
  const [industry, setIndustry] = useState('')
  const [industryOther, setIndustryOther] = useState('')
  const [mentorType, setMentorType] = useState<MentorType | ''>('')
  const [mentorTypeOther, setMentorTypeOther] = useState('')
  // P2-12 — open-to-mentorship + alum class year captured during E/M
  // onboarding so students see mentor data accurately on day one rather
  // than hoping mentors remember to flip it on later.
  // P0-4 — default ON for new E/M signups so the directory shows them
  // immediately. Profile-edit can flip it back off any time.
  const [openToMentorship, setOpenToMentorship] = useState(true)
  const [alumGradYear, setAlumGradYear] = useState('')
  const [studentSeeking, setStudentSeeking] = useState<StudentSeeking | ''>('')
  const [studentSeekingOther, setStudentSeekingOther] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  // Weekly availability for students: collecting it here closes the loop
  // where the only place students could ever set it was /profile, and
  // that meant the Applicants view was always empty (audit HIGH-8).
  const [weeklyAvailability, setWeeklyAvailability] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null)
  const [avatarBroken, setAvatarBroken] = useState(false)

  useEffect(() => {
    if (profile?.role === 'admin') navigate('/admin', { replace: true })
  }, [profile, navigate])

  if (!profile) return null

  // Already-onboarded users land on /explore — typing /onboarding directly
  // (or hitting browser history) shouldn't show the empty Welcome form,
  // and re-submission would null-out fields. Server-side, the save handler
  // also rejects re-submission since it sets onboarding_complete=true again
  // which is idempotent for ProtectedRoute's purposes.
  if (profile.onboarding_complete) {
    return <Navigate to="/explore" replace />
  }

  const welcome = ROLE_WELCOME[profile.role] ?? ROLE_WELCOME.student
  const isStudent = profile.role === 'student'
  const isEmployerMentor = profile.role === 'employer_mentor'

  // Sanity-check expected graduation year: within reach. The label says
  // "Expected graduation year" so only current/future students make sense
  // (allow currentYear − 1 for late-enrollers / mid-year onboarders).
  const currentYear = new Date().getFullYear()
  const minGradYear = currentYear - 1
  const maxGradYear = currentYear + 8
  const parsedGradYear = graduationYear ? parseInt(graduationYear, 10) : NaN
  const gradYearValid =
    !graduationYear ||
    (!isNaN(parsedGradYear) && parsedGradYear >= minGradYear && parsedGradYear <= maxGradYear)

  // Validation: sub-role fields + industry + company + interests (student) are required.
  // Audit M5 — company is now required for ALL employer/mentor sub-roles
  // (previously only Employer / Both). Mentor-only accounts often still
  // represent a workplace, and the platform's value prop depends on
  // knowing where someone is when they're posting.
  const employerNeedsCompany = isEmployerMentor
  const canSubmit = isEmployerMentor
    ? mentorType !== ''
        && (mentorType !== 'other' || mentorTypeOther.trim() !== '')
        && industry !== ''
        && (industry !== 'Other' || industryOther.trim() !== '')
        && (!employerNeedsCompany || company.trim().length > 0)
    : isStudent
    ? studentSeeking !== ''
        && (studentSeeking !== 'other' || studentSeekingOther.trim() !== '')
        && interests.length > 0
        && gradYearValid
    : true

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setAvatarUploadError(null)
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
    setAvatarBroken(false)
    setAvatarUploading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) {
      // Surface a specific, focusable message instead of silently no-opping
      // when a required field is empty (audit M3 / F-006).
      if (isStudent && studentSeeking === '') {
        setSaveError('Pick what you\'re looking for to continue.')
        document.getElementById('onboarding-student-seeking')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (isStudent && interests.length === 0) {
        setSaveError('Select at least one area of interest to continue.')
        document.getElementById('onboarding-interests')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (isEmployerMentor && !mentorType) {
        setSaveError('Pick whether you\'re an employer, mentor, or both.')
        document.getElementById('onboarding-mentor-type')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else if (isEmployerMentor && !industry) {
        setSaveError('Select your industry / area of expertise.')
      } else if (isEmployerMentor && !company.trim()) {
        setSaveError('Enter your company / organization name.')
      } else {
        setSaveError('Please fill in the required fields above.')
      }
      return
    }
    // Task 1 — bio + company text-filter check before save.
    const bioTerm = containsBlockedTerms(bio)
    if (bioTerm.blocked) {
      setSaveError(bioTerm.reason ?? 'Please revise your bio.')
      return
    }
    if (isEmployerMentor) {
      const companyTerm = containsBlockedTerms(company)
      if (companyTerm.blocked) {
        setSaveError(companyTerm.reason ?? 'Please revise the company name.')
        return
      }
    }

    setSaving(true)
    setSaveError(null)

    const updates: Record<string, unknown> = {
      onboarding_complete: true,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }

    if (isStudent) {
      const yr = parseInt(graduationYear)
      updates.graduation_year = isNaN(yr) ? null : yr
      updates.grade = grade || null
      updates.student_seeking = studentSeeking || null
      updates.student_seeking_other = studentSeeking === 'other' ? studentSeekingOther.trim() || null : null
      updates.interests = interests
      updates.weekly_availability = weeklyAvailability || null
    }

    if (isEmployerMentor) {
      updates.company = company.trim() || null
      updates.industry = industry === 'Other' ? (industryOther.trim() || null) : (industry || null)
      updates.mentor_type = mentorType || null
      updates.mentor_type_other = mentorType === 'other' ? mentorTypeOther.trim() || null : null
      // P2-12 — capture mentorship + alum-year intent at onboarding.
      updates.open_to_mentorship = openToMentorship
      const ay = parseInt(alumGradYear, 10)
      if (!isNaN(ay) && ay >= 1900 && ay <= 2100) updates.graduation_year = ay
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', profile!.id)
    if (error) {
      setSaving(false)
      setSaveError('Failed to save your profile. Please try again.')
      return
    }
    // Phase 5.6 — seed the first Career History entry from the company
    // they just supplied so the alum/mentor profile isn't visually empty
    // on day one. Best-effort: any failure here just means they fill it
    // in later on /profile/edit.
    if (isEmployerMentor && company.trim()) {
      const { data: existing } = await supabase
        .from('career_history')
        .select('id')
        .eq('profile_id', profile!.id)
        .limit(1)
      if (!existing || existing.length === 0) {
        const startYr = new Date().getFullYear()
        await supabase
          .from('career_history')
          .insert({
            profile_id: profile!.id,
            company: company.trim(),
            title: mentorType === 'mentor' ? 'Mentor' : 'Current role',
            start_year: startYr,
            end_year: null,
            is_current: true,
          })
      }
    }
    await refreshProfile()
    // Both roles land on /explore so they see the welcome dashboard (stats,
    // quick actions, curated previews) before being dropped into the full
    // job board (audit §15).
    // P2-13 — tell /explore to mount the post-onboarding tour exactly once.
    // The tour itself reads + clears this key.
    if (isEmployerMentor) {
      try { localStorage.setItem('crms.onboarding.show_em_tour', '1') } catch { /* ignore */ }
    }
    navigate('/explore', { replace: true })
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div
        className="w-full max-w-lg bg-surface rounded-2xl border border-border overflow-hidden"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        {/* Brand header */}
        <div
          className="px-8 py-6 text-white relative overflow-hidden"
          style={{
            background: `
              radial-gradient(ellipse 70% 120% at 85% 15%, rgba(74,124,47,0.7) 0%, transparent 60%),
              radial-gradient(ellipse 50% 100% at 10% 90%, rgba(45,80,22,0.5) 0%, transparent 50%),
              linear-gradient(155deg, #2D5016 0%, #3A6B1E 40%, #4A7C2F 70%, #3A6B1E 100%)
            `,
          }}
        >
          <div className="mb-4">
            {logoError ? (
              <span className="font-black text-2xl tracking-tight" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-accent)' }}>CRMS Connect</span>
            ) : (
              <img src={CRMS_LOGO} alt="Colorado Rocky Mountain School" className="h-10 w-auto object-contain brightness-0 invert" onError={() => setLogoError(true)} />
            )}
          </div>
          <div className="flex items-start gap-3">
            <Sparkles size={22} className="shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
            <div>
              <h1 className="text-xl font-bold leading-snug" style={{ fontFamily: 'var(--font-serif)' }}>{welcome.headline}</h1>
              <p className="text-sm text-white/75 mt-1 leading-relaxed">{welcome.sub}</p>
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink leading-tight">{profile.full_name}</p>
              <p className="text-xs text-ink-muted capitalize">
                {profile.role === 'employer_mentor' ? 'Employer / Mentor' : 'Student'}
              </p>
            </div>
          </div>

          <p className="text-sm font-medium text-ink mb-4">
            Set up your profile so others know who you are.
          </p>

          {saveError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-error-bg border border-status-rejected-border text-sm text-error">
              {saveError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Employer/Mentor sub-role (REQUIRED) ── */}
            {isEmployerMentor && (
              <div id="onboarding-mentor-type">
                <label className="block text-sm font-semibold text-ink mb-2">
                  Your role <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MENTOR_TYPES.map((t) => (
                    <button type="button"
                      key={t}
                      onClick={() => setMentorType(t)}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-center
                        ${mentorType === t
                          ? 'border-primary text-primary'
                          : 'border-border text-ink-secondary hover:border-border-strong hover:bg-primary-faint'
                        }`}
                      style={mentorType === t ? { backgroundColor: 'var(--color-primary-muted)' } : {}}
                    >
                      {MENTOR_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
                {mentorType === 'other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      value={mentorTypeOther}
                      onChange={(e) => setMentorTypeOther(e.target.value)}
                      placeholder="Please describe…"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                        placeholder:text-ink-placeholder
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                )}
                {employerNeedsCompany && (
                  <p className="mt-2 text-xs text-ink-muted">
                    A company / organization name is required.
                  </p>
                )}
              </div>
            )}

            {/* ── Student seeking (REQUIRED) ── */}
            {isStudent && (
              <div id="onboarding-student-seeking">
                <label className="block text-sm font-semibold text-ink mb-2">
                  I am looking for: <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STUDENT_SEEKINGS.map((s) => (
                    <button type="button"
                      key={s}
                      onClick={() => setStudentSeeking(s)}
                      className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-center
                        ${studentSeeking === s
                          ? 'border-primary text-primary'
                          : 'border-border text-ink-secondary hover:border-border-strong hover:bg-primary-faint'
                        }`}
                      style={studentSeeking === s ? { backgroundColor: 'var(--color-primary-muted)' } : {}}
                    >
                      {STUDENT_SEEKING_LABELS[s]}
                    </button>
                  ))}
                </div>
                {studentSeeking === 'other' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      required
                      value={studentSeekingOther}
                      onChange={(e) => setStudentSeekingOther(e.target.value)}
                      placeholder="Please describe…"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                        placeholder:text-ink-placeholder
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                  </div>
                )}
              </div>
            )}

            {/* ── Student grade ── */}
            {isStudent && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-ink-muted" />
                    Grade
                    <span className="text-ink-muted font-normal">(optional)</span>
                  </span>
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as StudentGrade | '')}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  <option value="">Select grade…</option>
                  {STUDENT_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Weekly availability (students) ── */}
            {isStudent && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  <span className="flex items-center gap-1.5">
                    Weekly availability
                    <span className="text-ink-muted font-normal">(optional)</span>
                  </span>
                </label>
                <select
                  value={weeklyAvailability}
                  onChange={(e) => setWeeklyAvailability(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                >
                  <option value="">Select your weekly hours…</option>
                  {WEEKLY_AVAILABILITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Graduation year (students) ── */}
            {isStudent && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-ink-muted" />
                    Expected graduation year
                    <span className="text-ink-muted font-normal">(optional)</span>
                  </span>
                </label>
                <input
                  type="number"
                  min={minGradYear}
                  max={maxGradYear}
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2027"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
                {graduationYear && !gradYearValid && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                    Please enter a year between {minGradYear} and {maxGradYear}.
                  </p>
                )}
              </div>
            )}

            {/* ── Company & Industry (employer/mentor) ── */}
            {isEmployerMentor && (
              <>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} className="text-ink-muted" />
                      Company / Organization
                      {employerNeedsCompany ? (
                        <span className="text-error">*</span>
                      ) : (
                        <span className="text-ink-muted font-normal">(optional)</span>
                      )}
                    </span>
                  </label>
                  <input
                    type="text"
                    required={employerNeedsCompany}
                    maxLength={120}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Where do you work?"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Layers size={14} className="text-ink-muted" />
                      Industry / Area of expertise <span className="text-error">*</span>
                    </span>
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  >
                    <option value="">Select an industry…</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {industry === 'Other' && (
                    <div className="mt-2">
                      <input
                        type="text"
                        required
                        value={industryOther}
                        onChange={(e) => setIndustryOther(e.target.value)}
                        placeholder="Please describe your industry…"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                          placeholder:text-ink-placeholder
                          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* P2-12 — alum class year + mentorship intent. Both
                    optional; defaults are off / blank so a non-alum
                    employer just leaves them. */}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Class year <span className="text-ink-muted font-normal">(if you're a CRMS alum)</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1900}
                    max={2100}
                    value={alumGradYear}
                    onChange={(e) => setAlumGradYear(e.target.value)}
                    placeholder="e.g. 2010"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-primary-faint cursor-pointer">
                  <input
                    type="checkbox"
                    checked={openToMentorship}
                    onChange={(e) => setOpenToMentorship(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-ink">Open to mentoring students</span>
                    <span className="block text-xs text-ink-muted mt-0.5">
                      On by default. When on, you appear in /mentors and students can request meetings. Flip it off any time in your profile.
                    </span>
                  </span>
                </label>
              </>
            )}

            {/* ── Student interests (REQUIRED) ── */}
            {isStudent && (
              <div id="onboarding-interests">
                <label className="block text-sm font-semibold text-ink mb-2">
                  Areas of interest <span className="text-error">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((opt) => {
                    const selected = interests.includes(opt)
                    return (
                      <button type="button"
                        key={opt}
                        onClick={() => setInterests((prev) => selected ? prev.filter((i) => i !== opt) : [...prev, opt])}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors
                          ${selected ? 'bg-primary text-white border-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
                {interests.length === 0 && (
                  <p className="mt-1 text-xs text-ink-muted">Select at least one interest to continue.</p>
                )}
              </div>
            )}

            {/* ── Bio ── */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                About you{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={
                  isStudent
                    ? 'e.g. I love environmental science and want to pursue sustainability consulting…'
                    : "e.g. I'm a software engineer at a tech company and love connecting with students interested in the field…"
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder resize-none
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            {/* ── Profile photo ── */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Profile photo{' '}
                <span className="text-ink-muted font-normal">(optional)</span>
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
                bg-primary-faint hover:bg-primary-faint/80 cursor-pointer text-sm text-ink-secondary transition-colors">
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

              {/* Fallback URL */}
              <p className="mt-2 text-xs text-ink-muted">Or paste a URL:</p>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => { setAvatarUrl(e.target.value); setAvatarBroken(false) }}
                placeholder="https://example.com/photo.jpg"
                className="mt-1 w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !canSubmit}
                className="btn-gold flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <ArrowRight size={16} />}
                {saving ? 'Saving…' : 'Complete setup'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
