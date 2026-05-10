import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Phase 2.4 — heart toggle a mentor (employer_mentor role) can flip on
 * a student card to add them to /shortlist. Renders nothing for any
 * non-mentor viewer. Note text is edited from /shortlist itself.
 *
 * The hydration is lazy: each card queries its own row on mount. That's
 * fine for the small directories we have today; a future iteration could
 * preload the mentor's full shortlist into context.
 */
interface Props {
  studentId: string
  /** Hint to size the heart icon — directory cards use 13, profile uses 16. */
  size?: number
  className?: string
}

export default function ShortlistButton({ studentId, size = 13, className = '' }: Props) {
  const { profile } = useAuth()
  const [shortlisted, setShortlisted] = useState(false)
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState(false)

  const canShortlist = profile?.role === 'employer_mentor' && profile.id !== studentId

  useEffect(() => {
    if (!canShortlist) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('mentor_shortlist')
        .select('id')
        .eq('mentor_id', profile!.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (!cancelled) {
        setShortlisted(!!data)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [canShortlist, profile?.id, studentId])

  if (!canShortlist) return null

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (busy || loading) return
    setBusy(true)
    if (shortlisted) {
      await supabase
        .from('mentor_shortlist')
        .delete()
        .eq('mentor_id', profile!.id)
        .eq('student_id', studentId)
      setShortlisted(false)
    } else {
      await supabase
        .from('mentor_shortlist')
        .insert({ mentor_id: profile!.id, student_id: studentId })
      setShortlisted(true)
    }
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || loading}
      aria-pressed={shortlisted}
      aria-label={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
      title={shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
      className={`inline-flex items-center justify-center rounded-md border transition-colors disabled:opacity-50 ${
        shortlisted
          ? 'border-primary bg-primary-muted text-primary'
          : 'border-border text-ink-muted hover:text-primary hover:border-primary'
      } ${className}`}
    >
      <Heart size={size} fill={shortlisted ? 'currentColor' : 'none'} />
    </button>
  )
}
