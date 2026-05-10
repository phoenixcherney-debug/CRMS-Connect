import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const SESSION_KEY = 'crms.photo_bio_nudge.dismissed'

/**
 * Phase 1.4 — sticky nudge for Mentor / Employer-Mentor accounts who
 * haven't filled in a profile photo + bio. Re-shows next visit until
 * both are set; the dismiss is session-only.
 *
 * Different from MentorModeBanner (which targets `open_to_mentorship =
 * false`). The two can co-exist; this one is about completion, not
 * visibility intent.
 */
export default function PhotoBioNudge() {
  const { profile } = useAuth()
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(SESSION_KEY) === '1' } catch { return false }
  })

  if (!profile) return null
  if (profile.role !== 'employer_mentor') return null
  if (dismissed) return null

  const hasPhoto = !!profile.avatar_url
  const hasBio = !!profile.bio && profile.bio.trim().length > 0
  if (hasPhoto && hasBio) return null

  // Pick the most actionable single message.
  const missing: string[] = []
  if (!hasPhoto) missing.push('a photo')
  if (!hasBio) missing.push('a bio')
  const linkLabel = !hasPhoto ? 'Add a photo →' : 'Add a bio →'

  return (
    <div className="mb-4 flex items-start gap-3 p-3 rounded-lg border border-accent/40 bg-accent-faint">
      <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center text-accent-dark shrink-0">
        <Camera size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">
          Mentors with photos and bios receive significantly more meeting requests.
        </p>
        <p className="text-xs text-ink-muted mt-0.5">
          You're missing {missing.join(' and ')}.{' '}
          <Link to="/profile/edit" className="text-primary hover:underline font-medium">
            {linkLabel}
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          try { sessionStorage.setItem(SESSION_KEY, '1') } catch { /* ignore */ }
          setDismissed(true)
        }}
        aria-label="Dismiss for this session"
        className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-accent-light transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
