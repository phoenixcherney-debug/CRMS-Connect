import { useState, useEffect } from 'react'
import type React from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Sparkles, Building2, Layers, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  INDUSTRY_OPTIONS, INTEREST_OPTIONS,
  MENTOR_TYPE_LABELS, STUDENT_SEEKING_LABELS, STUDENT_GRADES,
} from '../types'
import type { MentorType, StudentSeeking, StudentGrade } from '../types'
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
  const [studentSeeking, setStudentSeeking] = useState<StudentSeeking | ''>('')
  const [studentSeekingOther, setStudentSeekingOther] = useState('')
  const [interests, setInterests] = useState<string[]>([])
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

  const welcome = ROLE_WELCOME[profile.role] ?? ROLE_WELCOME.student
  const isStudent = profile.role === 'student'
  const isEmployerMentor = profile.role === 'employer_mentor'

  // Validation: sub-role fields + industry (EM) + interests (student) are required
  const canSubmit = isEmployerMentor
    ? mentorType !== '' && (mentorType !== 'other' || mentorTypeOther.trim() !== '') && industry !== '' && (industry !== 'Other' || industryOther.trim() !== '')
    : isStudent
    ? studentSeeking !== '' && (studentSeeking !== 'other' || studentSeekingOther.trim() !== '') && interests.length > 0
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
    if (!canSubmit) return
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
    }

    if (isEmployerMentor) {
      updates.company = company.trim() || null
      updates.industry = industry === 'Other' ? (industryOther.trim() || null) : (industry || null)
      updates.mentor_type = mentorType || null
      updates.mentor_type_other = mentorType === 'other' ? mentorTypeOther.trim() || null : null
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', profile!.id)
    if (error) {
      setSaving(false)
      setSaveError('Failed to save your profile. Please try again.')
      return
    }
    await refreshProfile()
    navigate(isStudent ? '/jobs' : '/explore', { replace: true })
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
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  I am joining as a(n): <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MENTOR_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
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
              </div>
            )}

            {/* ── Student seeking (REQUIRED) ── */}
            {isStudent && (
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  I am looking for: <span className="text-error">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STUDENT_SEEKINGS.map((s) => (
                    <button
                      key={s}
                      type="button"
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
                  min="1960"
                  max="2040"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder="e.g. 2027"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
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
                      <span className="text-ink-muted font-normal">(optional)</span>
                    </span>
                  </label>
                  <input
                    type="text"
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
              </>
            )}

            {/* ── Student interests (REQUIRED) ── */}
            {isStudent && (
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">
                  Areas of interest <span className="text-error">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((opt) => {
                    const selected = interests.includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
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
