import { useState } from 'react'
import { Heart, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './ToastProvider'
import Spinner from './Spinner'

const SESSION_DISMISS_KEY = 'mentor_mode_banner_dismissed'

/**
 * P0-2 — persistent dashboard nudge for employer/mentor accounts whose
 * `open_to_mentorship` flag is off. Most existing E/Ms have never found
 * the toggle; this surfaces a one-click flip without leaving /explore.
 *
 * Renders nothing for students, admins, E/Ms who already opted in, and
 * users who have dismissed it for the current browser session.
 */
export default function MentorModeBanner() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_DISMISS_KEY) === '1'
  )

  if (!profile) return null
  if (profile.role !== 'employer_mentor') return null
  if (profile.open_to_mentorship) return null
  if (dismissed) return null

  async function turnOn() {
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ open_to_mentorship: true })
      .eq('id', profile.id)
    setSaving(false)
    if (error) {
      toast('Could not turn on mentor mode. Please try again.', { kind: 'error' })
      return
    }
    await refreshProfile()
    toast("You're now visible to students looking for a mentor.")
  }

  function dismiss() {
    try { sessionStorage.setItem(SESSION_DISMISS_KEY, '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div
      className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-primary-muted"
      style={{ backgroundColor: 'var(--color-primary-faint)' }}
    >
      <div className="w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center text-primary shrink-0">
        <Heart size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">
          You're not currently visible to students looking for mentors.
        </p>
        <p className="text-xs text-ink-secondary mt-0.5">
          Turn on mentor mode and you'll appear in /mentors. You can flip it back off in your profile any time.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={turnOn}
          disabled={saving}
          className="btn-gold px-3 py-1.5 text-xs"
        >
          {saving && <Spinner size="sm" className="border-white/30 border-t-white" />}
          Turn on mentor mode
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-primary-muted transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
