import { useEffect, useState } from 'react'
import { Share2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Phase 4.6 — small "Y joined" callout for the inviter. Counts the
 * profiles that point at the viewer via invited_by_user_id. We don't
 * have a separate invites_sent table (the share link is the invite),
 * so this is "joined" only.
 */
export default function InviteSummary() {
  const { profile } = useAuth()
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    ;(async () => {
      const { count: c } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('invited_by_user_id', profile.id)
      if (!cancelled) setCount(c ?? 0)
    })()
    return () => { cancelled = true }
  }, [profile?.id])

  if (!count || count === 0) return null

  return (
    <div className="flex items-center gap-2 text-xs text-ink-secondary p-3 rounded-lg border border-border bg-primary-faint">
      <Share2 size={14} className="text-primary shrink-0" />
      <span>
        <span className="font-semibold text-ink">{count}</span> {count === 1 ? 'person has' : 'people have'} joined from your invite{count === 1 ? '' : 's'}. Thanks for spreading the word.
      </span>
    </div>
  )
}
