import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GraduationCap, Sparkles, Building2, Layers } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS, INDUSTRY_OPTIONS } from '../types'
import Spinner from '../components/Spinner'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

const ROLE_WELCOME: Record<string, { headline: string; sub: string }> = {
  student: {
    headline: 'Welcome to CRMS Connect!',
    sub: 'Discover internships, jobs, and mentors posted by CRMS alumni and parents.',
  },
  alumni: {
    headline: 'Welcome back to the CRMS family!',
    sub: 'Share opportunities from your network and connect with current students.',
  },
  parent: {
    headline: 'Welcome to CRMS Connect!',
    sub: 'Help students in the CRMS community by sharing opportunities you know about.',
  },
}

export default function Onboarding() {
  const { profile, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [bio, setBio] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [company, setCompany] = useState('')
  const [industry, setIndustry] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)

  if (!profile) return null

  const welcome = ROLE_WELCOME[profile.role] ?? ROLE_WELCOME.student
  const showGradYear = profile.role === 'student' || profile.role === 'alumni'
  const isPoster = profile.role === 'alumni' || profile.role === 'parent'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)

    const updates: Record<string, unknown> = {
      onboarding_complete: true,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }

    if (showGradYear) {
      const yr = parseInt(graduationYear)
      updates.graduation_year = isNaN(yr) ? null : yr
    }

    if (isPoster) {
      updates.company = company.trim() || null
      updates.industry = industry || null
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', profile!.id)
    if (error) {
      setSaving(false)
      setSaveError('Failed to save your profile. Please try again.')
      return
    }
    const role = profile!.role
    await refreshProfile()
    navigate(role === 'student' ? '/jobs' : '/explore', { replace: true })
  }

  async function handleSkip() {
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_complete: true })
      .eq('id', profile!.id)
    if (error) {
      setSaving(false)
      setSaveError('Something went wrong. Please try again.')
      return
    }
    const role = profile!.role
    await refreshProfile()
    navigate(role === 'student' ? '/jobs' : '/explore', { replace: true })
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
        {/* Brand header band */}
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
              <img
                src={CRMS_LOGO}
                alt="Colorado Rocky Mountain School"
                className="h-10 w-auto object-contain brightness-0 invert"
                onError={() => setLogoError(true)}
              />
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

        {/* Form */}
        <div className="px-8 py-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink leading-tight">{profile.full_name}</p>
              <p className="text-xs text-ink-muted capitalize">{ROLE_LABELS[profile.role]}</p>
            </div>
          </div>

          <p className="text-sm font-medium text-ink mb-4">
            Set up your profile so others know who you are.
            <span className="text-ink-muted font-normal"> (All fields optional — you can always update later.)</span>
          </p>

          {saveError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-error-bg border border-status-rejected-border text-sm text-error">
              {saveError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Graduation year */}
            {showGradYear && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-ink-muted" />
                    {profile.role === 'student' ? 'Expected graduation year' : 'CRMS graduation year'}
                  </span>
                </label>
                <input
                  type="number"
                  min="1960"
                  max="2040"
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  placeholder={profile.role === 'student' ? 'e.g. 2026' : 'e.g. 2008'}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    transition-colors"
                />
              </div>
            )}

            {/* Company & Industry (alumni/parent only) */}
            {isPoster && (
              <>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Building2 size={14} className="text-ink-muted" />
                      Company / Organization
                    </span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Where do you work?"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                      transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Layers size={14} className="text-ink-muted" />
                      Industry / Area of expertise
                    </span>
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                      transition-colors"
                  >
                    <option value="">Select an industry…</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                {profile.role === 'student'
                  ? 'About you (interests, goals, dream career…)'
                  : 'About you (your background, what you do now…)'}
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={
                  profile.role === 'student'
                    ? 'e.g. I love environmental science and want to pursue sustainability consulting…'
                    : "e.g. I'm a software engineer at Google and graduated in 2012. Happy to connect with students interested in tech…"
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder resize-none
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  transition-colors"
              />
            </div>

            {/* Avatar URL */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Profile photo URL
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="Paste a link to your photo (e.g. Google Drive, Imgur)"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                  placeholder:text-ink-placeholder
                  focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                  transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-gold flex-1"
              >
                {saving
                  ? <Spinner size="sm" className="border-white/30 border-t-white" />
                  : <ArrowRight size={16} />
                }
                {saving ? 'Saving…' : 'Complete setup'}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={saving}
                className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-muted
                  hover:bg-primary-faint hover:text-ink-secondary transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Skip for now
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
