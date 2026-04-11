import { useState, useEffect } from 'react'
import type React from 'react'
import {
  CheckCircle2, AlertCircle, User, Pencil, X, Plus, Trash2, Briefcase, Heart,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS, INDUSTRY_OPTIONS } from '../types'
import type { CareerHistory } from '../types'
import Spinner from '../components/Spinner'

export default function Profile() {
  const { profile, user, refreshProfile, loading } = useAuth()
  const [editing, setEditing] = useState(false)

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [company, setCompany] = useState('')
  const [industry, setIndustry] = useState('')
  const [openToMentorship, setOpenToMentorship] = useState(false)

  // Career history
  const [careerHistory, setCareerHistory] = useState<CareerHistory[]>([])
  const [careerLoading, setCareerLoading] = useState(false)
  const [newEntry, setNewEntry] = useState({ company: '', title: '', start_year: '', end_year: '', is_current: false })
  const [addingEntry, setAddingEntry] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const isPoster = profile?.role === 'alumni' || profile?.role === 'parent'

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setBio(profile.bio ?? '')
      setGraduationYear(profile.graduation_year?.toString() ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
      setCompany(profile.company ?? '')
      setIndustry(profile.industry ?? '')
      setOpenToMentorship(profile.open_to_mentorship ?? false)
    }
  }, [profile?.id])

  // Load career history
  useEffect(() => {
    if (!profile || !isPoster) return
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
  }, [profile?.id, isPoster])

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  if (!profile) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-surface rounded-2xl border border-border p-8 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
          <AlertCircle size={32} className="text-error mx-auto mb-3" />
          <p className="text-ink font-medium mb-1">Could not load profile</p>
          <p className="text-sm text-ink-secondary">
            There was a problem fetching your profile. Try refreshing the page.
          </p>
        </div>
      </div>
    )
  }

  const initials = profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  function handleCancel() {
    setFullName(profile!.full_name ?? '')
    setBio(profile!.bio ?? '')
    setGraduationYear(profile!.graduation_year?.toString() ?? '')
    setAvatarUrl(profile!.avatar_url ?? '')
    setCompany(profile!.company ?? '')
    setIndustry(profile!.industry ?? '')
    setOpenToMentorship(profile!.open_to_mentorship ?? false)
    setSaveError(null)
    setEditing(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaveSuccess(false)
    setSaving(true)

    const updates: Record<string, unknown> = {
      full_name: fullName.trim(),
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }

    if (profile?.role !== 'parent') {
      const yr = parseInt(graduationYear)
      updates.graduation_year = isNaN(yr) ? null : yr
    }

    if (isPoster) {
      updates.company = company.trim() || null
      updates.industry = industry || null
      updates.open_to_mentorship = openToMentorship
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile!.id)

    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      await refreshProfile()
      setEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  async function handleAddCareerEntry() {
    if (!newEntry.company.trim() || !newEntry.title.trim() || !newEntry.start_year) return
    setAddingEntry(true)
    const startYr = parseInt(newEntry.start_year)
    const endYr = newEntry.end_year ? parseInt(newEntry.end_year) : null

    const { data, error } = await supabase
      .from('career_history')
      .insert({
        profile_id: profile!.id,
        company: newEntry.company.trim(),
        title: newEntry.title.trim(),
        start_year: startYr,
        end_year: newEntry.is_current ? null : endYr,
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
    if (!error) {
      setCareerHistory((prev) => prev.filter((e) => e.id !== entryId))
    }
  }

  // In edit mode show the typed URL as a live preview; otherwise use saved value
  const previewAvatarUrl = editing ? avatarUrl : (profile.avatar_url ?? '')
  const [avatarBroken, setAvatarBroken] = useState(false)

  // Reset broken state when URL changes
  useEffect(() => {
    setAvatarBroken(false)
  }, [previewAvatarUrl])

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Profile</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            {editing ? 'Update your account details' : 'Your account details'}
          </p>
        </div>
        {!editing && (
          <button
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
        {/* Banner */}
        <div
          className="h-20 relative overflow-hidden"
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

        <div className="px-6 pb-6">
          {/* Avatar + name */}
          <div className="-mt-8 mb-5 flex items-end gap-4">
            <div className="w-16 h-16 rounded-2xl border-4 border-surface bg-primary-muted flex items-center justify-center overflow-hidden shrink-0">
              {previewAvatarUrl && !avatarBroken ? (
                <img
                  src={previewAvatarUrl}
                  alt={profile.full_name}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarBroken(true)}
                />
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
                {isPoster && profile.open_to_mentorship && (
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
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {profile.graduation_year && profile.role !== 'parent' && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">
                      {profile.role === 'student' ? 'Graduating' : 'Graduated'}
                    </span>
                    <span className="text-ink-secondary">{profile.graduation_year}</span>
                  </div>
                )}
                {isPoster && profile.company && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Company</span>
                    <span className="text-ink-secondary">{profile.company}</span>
                  </div>
                )}
                {isPoster && profile.industry && (
                  <div className="flex gap-2">
                    <span className="font-medium text-ink w-28 shrink-0">Industry</span>
                    <span className="text-ink-secondary">{profile.industry}</span>
                  </div>
                )}
              </div>

              {profile.bio ? (
                <div>
                  <p className="text-sm font-medium text-ink mb-1.5">Bio</p>
                  <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-ink-muted italic">
                  No bio yet — click Edit to add one.
                </p>
              )}

              {/* Career History (view mode) */}
              {isPoster && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                      <Briefcase size={14} className="text-ink-muted" />
                      Career History
                    </p>
                  </div>
                  {careerLoading ? (
                    <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                  ) : careerHistory.length === 0 ? (
                    <p className="text-sm text-ink-muted italic">No career history added yet — click Edit to add your experience.</p>
                  ) : (
                    <div className="space-y-2">
                      {careerHistory.map((entry) => (
                        <div key={entry.id} className="p-3 rounded-lg bg-primary-faint border border-border text-sm">
                          <p className="font-medium text-ink">{entry.title}</p>
                          <p className="text-ink-secondary">
                            {entry.company} · {entry.start_year}–{entry.is_current ? 'Present' : entry.end_year ?? ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {saveSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-success-bg border border-status-accepted-border px-4 py-3">
                  <CheckCircle2 size={16} className="text-success" />
                  <p className="text-sm text-success font-medium">Profile saved!</p>
                </div>
              )}
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
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Full name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                      transition-colors"
                  />
                </div>

                {profile.role !== 'parent' && (
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1.5">
                      Graduation year{' '}
                      <span className="text-ink-muted font-normal">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min="1960"
                      max="2040"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      placeholder={profile.role === 'student' ? 'e.g. 2026' : 'e.g. 2015'}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                        placeholder:text-ink-placeholder
                        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                        transition-colors"
                    />
                  </div>
                )}

                {isPoster && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        Company / Organization{' '}
                        <span className="text-ink-muted font-normal">(optional)</span>
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
                        Industry / Area of expertise{' '}
                        <span className="text-ink-muted font-normal">(optional)</span>
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
                        onClick={() => setOpenToMentorship(!openToMentorship)}
                        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors
                          ${openToMentorship ? 'bg-primary' : 'bg-border-strong'}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform
                            ${openToMentorship ? 'translate-x-5' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Bio{' '}
                    <span className="text-ink-muted font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell others a bit about yourself, your background, or what you do…"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                      placeholder:text-ink-placeholder resize-none
                      focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                      transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Profile photo URL{' '}
                    <span className="text-ink-muted font-normal">(optional)</span>
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

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving || !fullName.trim()}
                    className="btn-gold px-5 py-2.5"
                  >
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

              {/* Career History management (edit mode only, alumni/parent) */}
              {isPoster && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                      <Briefcase size={14} className="text-ink-muted" />
                      Career History
                    </p>
                    {!showAddForm && (
                      <button
                        onClick={() => setShowAddForm(true)}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary-light font-medium"
                      >
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
                            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors
                            disabled:opacity-50"
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
                        <button
                          onClick={handleAddCareerEntry}
                          disabled={addingEntry || !newEntry.title.trim() || !newEntry.company.trim() || !newEntry.start_year}
                          className="btn-gold"
                        >
                          {addingEntry ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Plus size={14} />}
                          {addingEntry ? 'Adding…' : 'Add'}
                        </button>
                        <button
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
                            <p className="text-ink-secondary">
                              {entry.company} · {entry.start_year}–{entry.is_current ? 'Present' : entry.end_year ?? ''}
                            </p>
                          </div>
                          <button
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
