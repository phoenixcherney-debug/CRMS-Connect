import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Send, MapPin, Calendar, Briefcase } from 'lucide-react'
import { format, isToday, isYesterday, isPast, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Message, Profile } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

interface JobSharePayload {
  type: 'job_share'
  id: string
  title: string
  company: string
  location: string
  job_type: string
  deadline: string
}

function parseJobShare(content: string): JobSharePayload | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed?.type === 'job_share') return parsed as JobSharePayload
  } catch {}
  return null
}

function JobShareCard({ payload, isMine }: { payload: JobSharePayload; isMine: boolean }) {
  const navigate = useNavigate()
  const deadline = parseISO(payload.deadline)
  const expired = isPast(deadline)
  return (
    <button
      onClick={() => navigate(`/jobs/${payload.id}`)}
      className={`text-left w-full max-w-[260px] rounded-2xl overflow-hidden border transition-all
        hover:shadow-md active:scale-[0.98]
        ${isMine
          ? 'bg-primary-light border-primary/30'
          : 'bg-surface border-border'
        }`}
    >
      {/* Colored top strip */}
      <div className={`px-3.5 pt-3 pb-2 ${isMine ? '' : 'border-b border-border'}`}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md
            ${isMine ? 'bg-white/20 text-white' : 'bg-primary-muted text-primary'}`}>
            {JOB_TYPE_LABELS[payload.job_type as keyof typeof JOB_TYPE_LABELS] ?? payload.job_type}
          </span>
          {expired && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md
              ${isMine ? 'bg-white/20 text-white/70' : 'bg-border/50 text-ink-muted'}`}>
              Closed
            </span>
          )}
        </div>
        <p className={`font-semibold text-sm leading-snug ${isMine ? 'text-white' : 'text-ink'}`}>
          {payload.title}
        </p>
        <p className={`text-xs mt-0.5 font-medium ${isMine ? 'text-white/80' : 'text-ink-secondary'}`}>
          {payload.company}
        </p>
      </div>
      <div className={`px-3.5 py-2.5 space-y-1 ${isMine ? 'bg-white/10' : 'bg-primary-faint'}`}>
        <p className={`flex items-center gap-1.5 text-xs ${isMine ? 'text-white/75' : 'text-ink-secondary'}`}>
          <MapPin size={11} />
          {payload.location}
        </p>
        <p className={`flex items-center gap-1.5 text-xs ${isMine ? 'text-white/75' : 'text-ink-secondary'}`}>
          <Calendar size={11} />
          Deadline: {format(deadline, 'MMM d, yyyy')}
        </p>
        <p className={`flex items-center gap-1.5 text-xs font-medium mt-1 ${isMine ? 'text-white/90' : 'text-primary'}`}>
          <Briefcase size={11} />
          View posting →
        </p>
      </div>
    </button>
  )
}

const PAGE_SIZE = 50

function formatMessageTime(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, h:mm a')
}

function formatDateDivider(iso: string) {
  const d = parseISO(iso)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMMM d')
}

function shouldShowDivider(curr: Message, prev: Message | undefined): boolean {
  if (!prev) return true
  const currDate = parseISO(curr.created_at).toDateString()
  const prevDate = parseISO(prev.created_at).toDateString()
  return currDate !== prevDate
}

export default function Conversation() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()

  const [messages, setMessages] = useState<Message[]>([])
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Tracks whether the initial scroll-to-bottom has happened for this conversation
  const hasInitialScrolled = useRef(false)

  // Reset scroll tracking when the conversation changes
  useEffect(() => {
    hasInitialScrolled.current = false
  }, [id])

  // Auto-resize textarea whenever content changes (replaces fieldSizing: 'content')
  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 144)}px`
  }, [content])

  // ─── Load conversation & initial messages ─────────────────────────────────
  useEffect(() => {
    if (!id || !profile) return

    async function load() {
      setLoading(true)
      setMessages([])
      setHasMore(false)

      // Find the other participant
      const { data: conv } = await supabase
        .from('conversations')
        .select('participant_one, participant_two')
        .eq('id', id!)
        .single()

      if (conv) {
        const otherId =
          conv.participant_one === profile!.id
            ? conv.participant_two
            : conv.participant_one

        const { data: other } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, graduation_year')
          .eq('id', otherId)
          .single()

        setOtherProfile(other as Profile)
      }

      // Load most recent PAGE_SIZE messages (descending, then reverse for display)
      const { data: msgs, count } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('conversation_id', id!)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      const sorted = ((msgs as Message[]) ?? []).reverse()
      setMessages(sorted)
      setHasMore((count ?? 0) > PAGE_SIZE)
      setLoading(false)

      // Mark unread messages from the other person as read
      const unreadIds = sorted
        .filter((m) => !m.is_read && m.sender_id !== profile!.id)
        .map((m) => m.id)

      if (unreadIds.length > 0) {
        await supabase.from('messages').update({ is_read: true }).in('id', unreadIds)
      }
    }

    load()
  }, [id, profile])

  // ─── Real-time new messages ───────────────────────────────────────────────
  useEffect(() => {
    if (!id || !profile) return

    const channel = supabase
      .channel(`conversation:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            // Avoid duplicates if our own insert fires the event
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          // Auto-mark as read if the other person sent it while we're viewing
          if (newMsg.sender_id !== profile.id) {
            await supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', newMsg.id)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id, profile?.id])

  // ─── Smart auto-scroll ────────────────────────────────────────────────────
  // Always scroll on initial load; on new messages only scroll if near bottom.
  useEffect(() => {
    if (loading) return
    const el = scrollRef.current
    const nearBottom = !el || (el.scrollHeight - el.scrollTop - el.clientHeight < 150)

    if (!hasInitialScrolled.current) {
      bottomRef.current?.scrollIntoView()
      hasInitialScrolled.current = true
    } else if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  // ─── Load earlier messages ────────────────────────────────────────────────
  async function loadMore() {
    if (!messages.length || loadingMore) return
    setLoadingMore(true)
    const oldestTs = messages[0].created_at

    const { data: older } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id!)
      .lt('created_at', oldestTs)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    const sorted = ((older as Message[]) ?? []).reverse()
    setMessages((prev) => [...sorted, ...prev])
    setHasMore(sorted.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  async function handleSend(e?: FormEvent) {
    e?.preventDefault()
    const text = content.trim()
    if (!text || !profile || sending) return

    setSending(true)
    setContent('') // Optimistic clear

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: profile.id,
      content: text,
      is_read: false,
    })

    setSending(false)
    if (error) {
      setContent(text) // Restore if the insert failed
      return
    }
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const initials = otherProfile?.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-6.5rem)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-border shrink-0">
        <Link
          to="/inbox"
          className="flex items-center gap-1 text-sm text-ink-secondary hover:text-ink"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Inbox</span>
        </Link>

        {otherProfile && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-muted flex items-center justify-center text-primary font-bold text-sm">
              {initials}
            </div>
            <div>
              <p className="font-semibold text-ink text-sm leading-tight">{otherProfile.full_name}</p>
              <p className="text-xs text-ink-muted capitalize">{otherProfile.role}</p>
            </div>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 pr-1">
        {loading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-full bg-primary-muted flex items-center justify-center text-primary text-xl font-bold mb-3">
              {initials}
            </div>
            <p className="text-sm font-medium text-ink">{otherProfile?.full_name}</p>
            <p className="text-xs text-ink-muted mt-1">
              Send a message to start the conversation.
            </p>
          </div>
        ) : (
          <>
            {/* Load earlier messages */}
            {hasMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink-secondary
                    px-3 py-1.5 rounded-lg border border-border hover:bg-primary-faint transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? <Spinner size="sm" /> : null}
                  {loadingMore ? 'Loading…' : 'Load earlier messages'}
                </button>
              </div>
            )}

            {messages.map((msg, i) => {
              const isMine = msg.sender_id === profile?.id
              const prev = messages[i - 1]
              const showDivider = shouldShowDivider(msg, prev)
              const showAvatar =
                !isMine && (i === 0 || messages[i - 1].sender_id !== msg.sender_id)

              return (
                <div key={msg.id}>
                  {showDivider && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[11px] text-ink-muted font-medium shrink-0">
                        {formatDateDivider(msg.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar placeholder to preserve alignment */}
                    <div className="w-7 shrink-0">
                      {showAvatar && !isMine && (
                        <div className="w-7 h-7 rounded-full bg-primary-muted flex items-center justify-center text-primary text-[11px] font-bold">
                          {initials}
                        </div>
                      )}
                    </div>

                    <div className={`max-w-[72%] group ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                      {(() => {
                        const jobShare = parseJobShare(msg.content)
                        if (jobShare) {
                          return <JobShareCard payload={jobShare} isMine={isMine} />
                        }
                        return (
                          <div
                            className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                              ${isMine
                                ? 'bg-primary text-white rounded-br-sm'
                                : 'bg-surface border border-border text-ink rounded-bl-sm'
                              }`}
                          >
                            {msg.content}
                          </div>
                        )
                      })()}
                      <span className="text-[11px] text-ink-muted mt-1 px-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="shrink-0 mt-4 pt-4 border-t border-border flex items-end gap-3"
      >
        <textarea
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 px-4 py-3 rounded-xl border border-border bg-surface text-ink text-sm
            placeholder:text-ink-placeholder resize-none overflow-y-auto
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
            transition-colors"
          style={{ maxHeight: '9rem' }}
        />
        <button
          type="submit"
          disabled={!content.trim() || sending}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl
            bg-primary hover:bg-primary-light text-white
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          {sending ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  )
}
