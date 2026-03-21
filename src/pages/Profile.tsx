import { useState, useEffect } from 'react'
import type React from 'react'
import { CheckCircle2, AlertCircle, User, Pencil, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

export default function Profile() {
  const { profile, user, refreshProfile, loading } = useAuth()
  const [editing, setEditing] = useState(false)

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setBio(profile.bio ?? '')
      setGraduationYear(profile.graduation_year?.toString() ?? '')
      setAvatarUrl(profile.avatar_url ?? '')
    }
  }, [profile?.id])

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
          <h1 className="text-2xl font-bold text-ink">Profile</h1>
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
        <div className="h-16 bg-gradient-to-r from-primary to-primary-light" />

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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-muted text-primary text-xs font-medium">
                <User size={11} />
                {ROLE_LABELS[profile.role]}
              </span>
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

              {saveSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-success-bg border border-green-200 px-4 py-3">
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
                <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-error-bg border border-red-200 px-4 py-3">
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
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg
                      bg-primary hover:bg-primary-light text-white font-medium text-sm
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
