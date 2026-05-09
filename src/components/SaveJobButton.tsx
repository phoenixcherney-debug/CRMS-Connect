import { useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './ToastProvider'

/**
 * P2-37 — bookmark/star toggle for an opportunity. Uses the
 * `saved_jobs` join table from migration 040. Optimistic UI: the
 * star fills immediately on click, the DB write follows.
 */
export default function SaveJobButton({ jobId, size = 16 }: { jobId: string; size?: number }) {
  const { profile } = useAuth()
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!profile) return
    let mounted = true
    supabase
      .from('saved_jobs')
      .select('job_id', { head: true, count: 'exact' })
      .eq('user_id', profile.id)
      .eq('job_id', jobId)
      .then(({ count }) => {
        if (mounted) setSaved((count ?? 0) > 0)
      })
    return () => { mounted = false }
  }, [profile?.id, jobId])

  if (!profile) return null

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    setPending(true)
    const next = !saved
    setSaved(next)  // optimistic
    if (next) {
      const { error } = await supabase
        .from('saved_jobs')
        .insert({ user_id: profile!.id, job_id: jobId })
      if (error) {
        setSaved(false)
        toast('Could not save the opportunity.', { kind: 'error' })
      } else {
        toast('Saved.')
      }
    } else {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('user_id', profile!.id)
        .eq('job_id', jobId)
      if (error) {
        setSaved(true)
        toast('Could not unsave.', { kind: 'error' })
      } else {
        toast('Removed from saved.')
      }
    }
    setPending(false)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? 'Remove from saved' : 'Save opportunity'}
      aria-pressed={saved}
      title={saved ? 'Remove from saved' : 'Save for later'}
      className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
        saved
          ? 'border-primary text-primary bg-primary-faint'
          : 'border-border text-ink-muted hover:text-ink hover:bg-primary-faint'
      } disabled:opacity-50`}
    >
      {saved ? <BookmarkCheck size={size} /> : <Bookmark size={size} />}
    </button>
  )
}
