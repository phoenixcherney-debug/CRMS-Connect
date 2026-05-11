import { useState } from 'react'
import { Heart, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

/**
 * Task 3 — yearly mentor reconfirmation prompt.
 *
 * Fires once when a logged-in employer/mentor's `open_to_mentorship` is
 * true AND their `mentor_consent_confirmed_at` is older than 365 days
 * (or null). "I'm still in" stamps the timestamp; "Pause for now" flips
 * the toggle off and stops the prompt re-firing this cycle.
 */
export default function MentorReconfirmPrompt() {
  const { profile, refreshProfile } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!profile || profile.role !== 'employer_mentor') return null
  if (!profile.open_to_mentorship) return null
  if (dismissed) return null

  const last = profile.mentor_consent_confirmed_at
    ? new Date(profile.mentor_consent_confirmed_at).getTime()
    : 0
  const stale = Date.now() - last > ONE_YEAR_MS
  if (!stale) return null

  async function confirm() {
    setSubmitting(true)
    await supabase
      .from('profiles')
      .update({ mentor_consent_confirmed_at: new Date().toISOString() })
      .eq('id', profile!.id)
    await refreshProfile()
    setSubmitting(false)
    setDismissed(true)
  }

  async function pause() {
    setSubmitting(true)
    // Setting open_to_mentorship=false also stops the prompt (the
    // top-level guard above hides it).
    await supabase
      .from('profiles')
      .update({ open_to_mentorship: false })
      .eq('id', profile!.id)
    await refreshProfile()
    setSubmitting(false)
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Heart size={18} className="text-primary" />
          <h2 className="text-base font-semibold text-ink">Still open to mentoring?</h2>
        </div>
        <p className="text-sm text-ink-secondary leading-relaxed mb-4">
          It's been about a year since you confirmed you're open to mentoring CRMS students. Want to stay listed on the Mentors page, or take a break?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={confirm}
            className="flex-1 btn-gold text-sm"
          >
            Yes, I'm still in
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={pause}
            className="flex-1 px-3 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint disabled:opacity-50"
          >
            Pause for now
          </button>
        </div>
        <button
          type="button"
          onClick={pause}
          className="mt-3 text-xs text-ink-muted hover:text-ink flex items-center gap-1 mx-auto"
          aria-label="Dismiss (treated as pause)"
        >
          <X size={11} /> Dismiss (pauses mentor mode)
        </button>
      </div>
    </div>
  )
}
