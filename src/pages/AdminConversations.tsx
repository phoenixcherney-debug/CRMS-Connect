import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, MessageSquare, ChevronRight, Shield } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'
import Spinner from '../components/Spinner'

/**
 * Admin moderation — browse every DM thread on the platform. Backed
 * by admin_list_conversations() (SECURITY DEFINER, admin-only). The
 * thread reader reuses the regular /messages Conversation page,
 * which can already render any thread the caller is allowed to read
 * (RLS migration 081 widens that to is_admin()).
 */
interface Row {
  id: string
  created_at: string
  last_message_at: string | null
  message_count: number
  participant_one: string
  participant_one_name: string
  participant_two: string
  participant_two_name: string
}

const PAGE_SIZE = 50

export default function AdminConversations() {
  const [rows, setRows]       = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset]   = useState(0)
  const [done, setDone]       = useState(false)
  const [search, setSearch]   = useState('')
  const [error, setError]     = useState<string | null>(null)

  async function load(reset = false) {
    setLoading(true)
    setError(null)
    const next = reset ? 0 : offset
    const { data, error: err } = await supabase.rpc('admin_list_conversations', {
      p_limit: PAGE_SIZE,
      p_offset: next,
    })
    setLoading(false)
    if (err) { setError(friendlyError(err, 'Could not load conversations.')); return }
    const page = (data ?? []) as Row[]
    setRows((prev) => reset ? page : [...prev, ...page])
    setOffset(next + page.length)
    if (page.length < PAGE_SIZE) setDone(true)
  }

  useEffect(() => { load(true) }, [])

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      r.participant_one_name?.toLowerCase().includes(q)
      || r.participant_two_name?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary-muted)' }}>
          <Shield size={17} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>All conversations</h1>
          <p className="text-xs text-ink-muted">Admin moderation view. Read any thread between any two users.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg border text-sm" style={{ backgroundColor: 'var(--color-error-bg)', borderColor: 'var(--color-error-border)', color: 'var(--color-error)' }}>
          {error}
        </div>
      )}

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by participant name…"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-ink-muted py-12">No conversations.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border bg-surface">
          {filtered.map((row) => (
            <Link
              key={row.id}
              to={`/admin/messages/${row.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-primary-faint transition-colors"
            >
              <MessageSquare size={15} className="text-ink-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">
                  {row.participant_one_name ?? '(deleted)'} ⇄ {row.participant_two_name ?? '(deleted)'}
                </p>
                <p className="text-xs text-ink-muted">
                  {row.message_count} message{row.message_count === 1 ? '' : 's'}
                  {row.last_message_at && (
                    <> · last {formatDistanceToNow(parseISO(row.last_message_at), { addSuffix: true })}</>
                  )}
                </p>
              </div>
              <ChevronRight size={14} className="text-ink-muted shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {!done && !loading && rows.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => load(false)}
            className="px-4 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
