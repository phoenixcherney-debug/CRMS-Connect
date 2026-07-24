import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { useAuth } from '../../contexts/AuthContext'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PushToggle } from '../../components/PushToggle'
import { timeAgo } from '../../lib/format'
import { friendlyError } from '../../lib/errors'
import type { AppNotification } from '../../types'

export function Notifications() {
  const { user } = useAuth()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (isActive: () => boolean) => {
    if (!user) return
    const { data, error: err } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!isActive()) return
    if (err) { setError(friendlyError(err)); return }
    setError(null)
    setItems(data ?? [])
    // Everything visible is now read.
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  }, [user])

  usePageData(load)

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl">Notifications</h1>
        <div className="mt-6"><PushToggle /></div>
        <div className="mt-6"><EmptyState title="We couldn’t load your notifications">{error}</EmptyState></div>
      </div>
    )
  }
  if (items === null) return <Spinner page />

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl">Notifications</h1>
      <div className="mt-6">
        <PushToggle />
      </div>
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState title="Nothing yet">
            When someone knocks, replies, or staff approves something of yours, it lands here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {items.map((n) => {
              const inner = (
                <div className="flex items-baseline gap-3 px-5 py-4">
                  {!n.read_at && <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full bg-clay" aria-label="Unread" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    {n.body && <p className="mt-0.5 truncate text-sm text-faint">{n.body}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-faint">{timeAgo(n.created_at)}</span>
                </div>
              )
              return (
                <li key={n.id}>
                  {n.link ? <Link to={n.link} className="block hover:bg-meadow/50">{inner}</Link> : inner}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
