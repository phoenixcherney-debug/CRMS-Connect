import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from './ToastProvider'
import Spinner from './Spinner'

/**
 * Phase 1.2 — full-screen one-time card shown to fresh Mentor or
 * Employer-Mentor accounts confirming they're visible on /mentors. Gated
 * by `profiles.seen_mentor_visibility_card`; "Got it" sets the flag,
 * "Hide me for now" sets the flag AND flips open_to_mentorship off.
 */
export default function MentorVisibilityCard() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState<'got-it' | 'hide' | null>(null)

  if (!profile) return null
  if (profile.role !== 'employer_mentor') return null
  if (profile.seen_mentor_visibility_card) return null
  // Only show when the user is currently visible. If a fresh account
  // already has open_to_mentorship=false (e.g. they came in via the new
  // "Other" path), the message would be wrong.
  if (!profile.open_to_mentorship) return null

  async function gotIt() {
    if (!profile) return
    setBusy('got-it')
    const { error } = await supabase
      .from('profiles')
      .update({ seen_mentor_visibility_card: true })
      .eq('id', profile.id)
    if (error) {
      toast('Something went wrong. Please try again.', { kind: 'error' })
      setBusy(null)
      return
    }
    await refreshProfile()
    setBusy(null)
  }

  async function hideMe() {
    if (!profile) return
    setBusy('hide')
    const { error } = await supabase
      .from('profiles')
      .update({
        seen_mentor_visibility_card: true,
        open_to_mentorship: false,
      })
      .eq('id', profile.id)
    if (error) {
      toast('Could not update your visibility. Please try again.', { kind: 'error' })
      setBusy(null)
      return
    }
    await refreshProfile()
    toast("We've hidden your profile. You can turn it back on any time from Edit Profile.")
    setBusy(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 overflow-y-auto">
      <div
        className="bg-surface rounded-2xl border border-border max-w-md w-full p-7 sm:p-8 text-center"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="w-14 h-14 rounded-full bg-success-bg mx-auto mb-4 flex items-center justify-center">
          <CheckCircle2 size={28} className="text-success" />
        </div>
        <h2 className="text-xl font-bold text-ink mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
          You're visible to students.
        </h2>
        <p className="text-sm text-ink-secondary leading-relaxed mb-6">
          Your name, role, and bio appear on the Mentors page. Students can
          request meetings. We won't share your email until you accept.
        </p>
        <button
          type="button"
          onClick={gotIt}
          disabled={busy !== null}
          className="btn-gold w-full px-4 py-2.5"
        >
          {busy === 'got-it' && <Spinner size="sm" className="border-white/30 border-t-white" />}
          Got it
        </button>
        <button
          type="button"
          onClick={hideMe}
          disabled={busy !== null}
          className="mt-2 text-xs text-ink-muted hover:text-ink underline disabled:opacity-50"
        >
          {busy === 'hide' ? 'Hiding…' : 'Hide me for now'}
        </button>
      </div>
    </div>
  )
}
