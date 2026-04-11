import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageSquare, Clock, SquarePen, Search, X, User } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Conversation, Message, Profile } from '../types'
import { ROLE_LABELS } from '../types'
import Spinner from '../components/Spinner'

type ConvWithMeta = Conversation & {
  otherProfile: Profile
  lastMessage: Message | null
  unreadCount: number
}

export default function Messages() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState<ConvWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  // New conversation modal
  const [composeOpen, setComposeOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  async function load() {
    if (!profile) return

    const { data: convs } = await supabase
      .from('conversations')
      .select('id, created_at, participant_one, participant_two')
      .or(`participant_one.eq.${profile.id},participant_two.eq.${profile.id}`)

    if (!convs || convs.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const convIds = convs.map((c) => c.id)
    const otherUserIds = [
      ...new Set(
        convs.map((c) =>
          c.participant_one === profile.id ? c.participant_two : c.participant_one
        )
      ),
    ]

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', otherUserIds)

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

    // Fetch last message per conversation + unread counts efficiently
    const lastMsgMap: Record<string, Message> = {}
    const unreadMap: Record<string, number> = {}

    // Get the most recent message per conversation (1 per conv, not all messages)
    await Promise.all(
      convIds.map(async (cid) => {
        const [{ data: lastMsg }, { count: unread }] = await Promise.all([
          supabase
            .from('messages')
            .select('id, conversation_id, content, created_at, sender_id, is_read')
            .eq('conversation_id', cid)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', cid)
            .eq('is_read', false)
            .neq('sender_id', profile.id),
        ])
        if (lastMsg) lastMsgMap[cid] = lastMsg as Message
        if (unread && unread > 0) unreadMap[cid] = unread
      })
    )

    const enriched: ConvWithMeta[] = convs
      .map((c) => {
        const otherId =
          c.participant_one === profile.id ? c.participant_two : c.participant_one
        return {
          ...c,
          otherProfile: profileMap[otherId] as Profile,
          lastMessage: lastMsgMap[c.id] ?? null,
          unreadCount: unreadMap[c.id] ?? 0,
        }
      })
      .sort((a, b) => {
        const at = a.lastMessage?.created_at ?? a.created_at
        const bt = b.lastMessage?.created_at ?? b.created_at
        return bt.localeCompare(at)
      })

    setConversations(enriched)
    setLoading(false)
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel('messages-list-refresh')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  // Search users when compose modal is open
  useEffect(() => {
    if (!composeOpen) return
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [composeOpen])

  useEffect(() => {
    if (!composeOpen || !profile) return

    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .neq('id', profile.id)
        .ilike('full_name', `%${q}%`)
        .limit(10)

      setSearchResults((data as Profile[]) ?? [])
      setSearchLoading(false)
    }, 250)

    return () => clearTimeout(timeout)
  }, [searchQuery, composeOpen, profile])

  async function openOrCreateConversation(otherId: string) {
    if (!profile || creatingFor) return
    setCreatingFor(otherId)

    // Check for existing conversation in either direction
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_one.eq.${profile.id},participant_two.eq.${otherId}),` +
        `and(participant_one.eq.${otherId},participant_two.eq.${profile.id})`
      )
      .maybeSingle()

    if (existing) {
      setCreatingFor(null)
      setComposeOpen(false)
      navigate(`/messages/${existing.id}`)
      return
    }

    const [p1, p2] = [profile.id, otherId].sort()
    const { data: created } = await supabase
      .from('conversations')
      .insert({ participant_one: p1, participant_two: p2 })
      .select('id')
      .single()

    setCreatingFor(null)
    setComposeOpen(false)
    if (created) navigate(`/messages/${created.id}`)
  }

  function closeCompose() {
    setComposeOpen(false)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Messages</h1>
          <p className="text-ink-secondary text-sm mt-0.5">Your direct conversations</p>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="btn-gold px-4 py-2"
          title="New conversation"
        >
          <SquarePen size={15} />
          New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <MessageSquare size={36} className="mx-auto text-ink-muted mb-3" />
          <p className="text-ink-muted text-sm mb-1 font-medium">No conversations yet</p>
          <p className="text-ink-muted text-xs">
            Hit <strong>New</strong> to start one, or message someone from a job listing.
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          {conversations.map((conv) => {
            if (!conv.otherProfile) return null
            const initials = conv.otherProfile.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <Link
                key={conv.id}
                to={`/messages/${conv.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-primary-faint transition-colors"
              >
                <div className="relative shrink-0">
                  <div className="w-11 h-11 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm">
                    {initials}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>
                      {conv.otherProfile.full_name}
                    </p>
                    <span className="text-xs text-ink-muted shrink-0 flex items-center gap-1">
                      <Clock size={11} />
                      {formatDistanceToNow(
                        parseISO(conv.lastMessage?.created_at ?? conv.created_at),
                        { addSuffix: true }
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted capitalize mb-0.5">
                    {conv.otherProfile.role}
                  </p>
                  {conv.lastMessage ? (
                    <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-ink-secondary font-medium' : 'text-ink-muted'}`}>
                      {conv.lastMessage.sender_id === profile?.id ? 'You: ' : ''}
                      {conv.lastMessage.content}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-muted italic">Start the conversation →</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Compose modal */}
      {composeOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={closeCompose}
          />

          <div
            className="relative w-full max-w-md bg-surface rounded-2xl border border-border overflow-hidden"
            style={{ boxShadow: 'var(--shadow-modal)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-ink">New conversation</h2>
              <button
                onClick={closeCompose}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-border">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search by name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-border bg-surface text-ink text-sm
                    placeholder:text-ink-placeholder
                    focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                    transition-colors"
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto">
              {searchLoading ? (
                <div className="flex justify-center py-8">
                  <Spinner size="sm" />
                </div>
              ) : searchQuery.trim() === '' ? (
                <div className="flex flex-col items-center py-10 text-center px-5">
                  <User size={28} className="text-ink-muted mb-2" />
                  <p className="text-sm text-ink-muted">Type a name to search for people</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-ink-muted">No users found for "{searchQuery}"</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {searchResults.map((u) => {
                    const initials = u.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)
                    return (
                      <button
                        key={u.id}
                        disabled={!!creatingFor}
                        onClick={() => openOrCreateConversation(u.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5
                          hover:bg-primary-faint transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{u.full_name}</p>
                          <p className="text-xs text-ink-muted">{ROLE_LABELS[u.role]}</p>
                        </div>
                        {creatingFor === u.id && <Spinner size="sm" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
