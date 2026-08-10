import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { advanceRequest } from '../../lib/mutations'
import { THREAD_POLL_MS } from '../../lib/constants'
import { OFFER_POSTER_JOIN, REQUEST_STUDENT_JOIN } from '../../lib/joins'
import { threadCapabilities } from '../../lib/permissions'
import { useAuth } from '../../contexts/AuthContext'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { TextAreaField } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { PersonLink } from '../../components/PersonLink'
import { ReportButton } from '../../components/ReportButton'
import { friendlyError } from '../../lib/errors'
import { messageTime } from '../../lib/format'
import { REQUEST_STATUS_META, OFFER_KIND_META, personName } from '../../types'
import type { HandRaise, Message, Offer, PublicProfile } from '../../types'

type PersonLite = Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year' | 'organization'>

type ThreadData = HandRaise & {
  // The offer join can come back null in a degraded state (e.g. the offer was
  // hard-removed); every dereference below guards for it so the thread never
  // white-screens. Either party's profile join is likewise null once disabled.
  offer: (Offer & { poster: PersonLite | null }) | null
  student: PersonLite | null
}

const DECLINE_TEMPLATE =
  'Thanks for knocking — I\'ve already filled this one, but I\'m glad you went for it. Keep an eye on the board.'

/** The request thread: student + poster + staff, scoped to one knock.
 *  This is the only messaging surface in the product, by design. */
export function Thread() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const toast = useToast()

  const [thread, setThread] = useState<ThreadData | null>(null)
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [decideOpen, setDecideOpen] = useState<'accept' | 'decline' | null>(null)
  const [declineNote, setDeclineNote] = useState(DECLINE_TEMPLATE)
  const [deciding, setDeciding] = useState(false)
  const [moderatingId, setModeratingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const firstLoad = useRef(true)
  // Once the thread has loaded once, background poll failures must not blow away
  // the rendered thread (and the composer + the student's in-progress draft).
  const hasLoaded = useRef(false)
  // Newest message timestamp we've loaded, so a background poll fetches only
  // newer messages instead of re-transferring the whole history each tick.
  const lastMessageAt = useRef<string | null>(null)

  // Note: the route mounts <Thread key={id}>, so switching :id remounts this
  // component and resets every ref/state above — no stale-thread carryover
  // (nit C-02). There is intentionally no reset effect here.

  const load = useCallback(async (isActive: () => boolean) => {
    if (!id) return
    // Don't poll a backgrounded tab (only skip after the first successful load).
    if (hasLoaded.current && typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    const { data, error } = await supabase
      .from('requests')
      .select(`*,
        offer:offers!requests_offer_id_fkey(*, ${OFFER_POSTER_JOIN}),
        ${REQUEST_STUDENT_JOIN}`)
      .eq('id', id)
      .maybeSingle()
    if (!isActive()) return
    if (error) {
      if (!hasLoaded.current) setLoadError(friendlyError(error))
      return
    }
    if (!data) {
      if (!hasLoaded.current) setLoadError('This thread doesn\'t exist, or you\'re not part of it.')
      return
    }

    // Incremental messages: full fetch on the first load, only-newer on polls.
    const base = supabase.from('messages').select('*').eq('request_id', id).order('created_at', { ascending: true })
    const since = lastMessageAt.current
    const incremental = hasLoaded.current && since != null
    const { data: msgs, error: msgError } = await (incremental ? base.gt('created_at', since!) : base)
    if (!isActive()) return
    if (msgError) {
      if (!hasLoaded.current) setLoadError(friendlyError(msgError))
      return
    }

    setThread(data)
    const fetched = (msgs ?? []) as Message[]
    if (incremental) {
      if (fetched.length > 0) {
        setMessages((prev) => {
          const existing = prev ?? []
          const seen = new Set(existing.map((m) => m.id))
          const added = fetched.filter((m) => !seen.has(m.id))
          return added.length > 0 ? [...existing, ...added] : existing
        })
      }
    } else {
      setMessages(fetched)
    }
    if (fetched.length > 0) lastMessageAt.current = fetched[fetched.length - 1].created_at
    setLoadError(null)
    hasLoaded.current = true
  }, [id])

  usePageData(load, THREAD_POLL_MS)

  useEffect(() => {
    if (messages && firstLoad.current) {
      firstLoad.current = false
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages])

  if (loadError) {
    return (
      <Card className="text-center">
        <p className="text-sm text-faint">{loadError}</p>
        <Link to="/home" className="mt-4 inline-block text-sm text-pine hover:underline">Home</Link>
      </Card>
    )
  }
  if (!thread || !profile || messages === null) return <Spinner page />

  const offer = thread.offer
  // Capability derivation lives in src/lib/permissions.ts so each branch is
  // unit-tested rather than reachable only through live-DB e2e.
  const { isStudent, isPoster, isAdmin, canMessage, posterCanDecide, studentCanWithdraw, backTo, backLabel } =
    threadCapabilities(
      { id: profile.id, role: profile.role },
      {
        studentId: thread.student_id,
        posterId: offer?.posted_by ?? null,
        offerId: thread.offer_id,
        status: thread.status,
      },
    )
  const status = REQUEST_STATUS_META[thread.status]
  const otherParty: PersonLite | null = isStudent ? (offer?.poster ?? null) : thread.student
  const studentName = personName(thread.student)
  const offerTitle = offer?.title ?? 'a removed offer'
  const offerKindLabel = offer ? OFFER_KIND_META[offer.kind].label : 'Offer'

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!profile || !thread || !body.trim()) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      request_id: thread.id,
      sender_id: profile.id,
      body: body.trim(),
    })
    if (error) {
      setSending(false)
      toast(friendlyError(error), 'error')
      return
    }
    // First reply from the poster moves the request into conversation; surface a
    // failure instead of dropping it silently (review A-06).
    if (isPoster && thread.status === 'sent') {
      const { error: advErr } = await advanceRequest(thread.id, 'in_conversation')
      if (advErr) toast('Message sent, but updating the status failed — refresh to retry.', 'error')
    }
    setSending(false)
    setBody('')
    load(() => true)
  }

  async function decide(next: 'accepted' | 'declined') {
    if (!thread || !profile) return
    setDeciding(true)
    if (next === 'declined' && declineNote.trim()) {
      const { error: noteErr } = await supabase.from('messages').insert({
        request_id: thread.id,
        sender_id: profile.id,
        body: declineNote.trim(),
      })
      // Abort the decline if the softening note couldn't post, rather than
      // committing the decline and silently losing the note (review A-06).
      if (noteErr) {
        setDeciding(false)
        toast(friendlyError(noteErr), 'error')
        return
      }
    }
    const { error } = await advanceRequest(thread.id, next)
    setDeciding(false)
    setDecideOpen(null)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(next === 'accepted' ? 'Accepted — the thread stays open to sort out details.' : 'Declined kindly.')
    load(() => true)
  }

  /** Staff redaction: hide (or restore) a single message. The schema has always
   *  supported this — messages.hidden_at, and messages_select excludes hidden
   *  rows for non-admins — but no client ever wrote it, so an abusive message to
   *  a minor stayed permanently visible with no in-app remedy (review major). */
  async function setHidden(message: Message, hide: boolean) {
    setModeratingId(message.id)
    const { error } = await supabase
      .from('messages')
      .update({ hidden_at: hide ? new Date().toISOString() : null })
      .eq('id', message.id)
    setModeratingId(null)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(hide ? 'Message removed from the thread.' : 'Message restored.')
    // Force a full message refetch rather than the usual incremental one — the
    // change is to an *existing* row, which `.gt('created_at', since)` skips.
    lastMessageAt.current = null
    load(() => true)
  }

  async function withdraw() {
    if (!thread) return
    const { error } = await advanceRequest(thread.id, 'withdrawn')
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast('Knock withdrawn.')
    load(() => true)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to={backTo} className="text-sm text-faint hover:text-ink">
        ← {backLabel}
      </Link>

      <Card className="mt-4" padded>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-faint">{offerKindLabel}</p>
            {/* The offer title is this page's subject; it used to be a Link
                styled to look like a heading, leaving the app's core screen
                with no h1 at all. The base rule in index.css already applies
                Fraunces 600 to h1, so the display classes come off. */}
            <h1 className="mt-1 text-lg leading-snug">
              <Link to={`/board/${thread.offer_id}`} className="text-ink hover:text-pine">
                {offerTitle}
              </Link>
            </h1>
          </div>
          <Badge tint={status.tint}>{isStudent ? status.student : status.label}</Badge>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <PersonLink person={otherParty} size="sm" sub={otherParty?.organization ?? null} />
        </div>
        {(posterCanDecide || studentCanWithdraw) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {posterCanDecide && (
              <>
                <Button size="sm" onClick={() => setDecideOpen('accept')}>Accept</Button>
                <Button size="sm" variant="secondary" onClick={() => setDecideOpen('decline')}>Decline</Button>
              </>
            )}
            {studentCanWithdraw && (
              <Button size="sm" variant="ghost" onClick={withdraw}>Withdraw my knock</Button>
            )}
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center gap-2 rounded-lg bg-meadow px-3.5 py-2 text-xs text-pine">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        {isAdmin && !isPoster && !isStudent
          ? 'You\'re viewing as staff. Anything you send is labeled CRMS Staff.'
          : 'CRMS staff can read this thread — that\'s what keeps the board safe for everyone.'}
      </div>

      {/* The student's original note opens the thread.
          role="log" (not aria-live on the whole list) is the right fit for
          chronologically appended history: the 15s poll appends replies, and
          without a live region a screen-reader user was never told one arrived
          on the product's only messaging surface. */}
      <div className="mt-6 space-y-4" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
        <MessageBubble
          name={studentName}
          mine={isStudent}
          staff={false}
          time={thread.created_at}
          body={thread.note}
          label="Opening note"
        />
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            name={m.sender_id === thread.student_id ? studentName : m.is_staff ? 'CRMS Staff' : personName(offer?.poster)}
            mine={m.sender_id === profile.id}
            staff={m.is_staff}
            time={m.created_at}
            body={m.body}
            hidden={!!m.hidden_at}
            // Staff-only redaction. messages_update is admin-only in RLS, and
            // enforce_message_guard stamps hidden_by + keeps the body immutable,
            // so this can hide history but never rewrite it.
            onModerate={isAdmin ? () => setHidden(m, !m.hidden_at) : undefined}
            moderating={moderatingId === m.id}
            reportable={m.sender_id !== profile.id}
            messageId={m.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {canMessage ? (
        <form onSubmit={send} className="mt-6">
          <TextAreaField
            label="Reply"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={3000}
            placeholder="Write a message…"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            {otherParty ? (
              <ReportButton target="user" targetId={otherParty.id} label="Flag this conversation" />
            ) : <span />}
            <Button type="submit" loading={sending} disabled={!body.trim()}>Send</Button>
          </div>
        </form>
      ) : (
        <p className="mt-6 text-center text-sm text-faint">
          This thread is closed{thread.status === 'declined' ? ' — this one didn\'t work out.' : '.'}
        </p>
      )}

      <Modal open={decideOpen === 'accept'} onClose={() => setDecideOpen(null)} title={`Accept ${studentName}?`}>
        <p className="text-sm text-faint">
          They'll be notified right away, and the thread stays open so you can sort out details.
          {offer && offer.spots === 1 ? ' This fills your offer and takes it off the open board.' : ''}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDecideOpen(null)}>Not yet</Button>
          <Button loading={deciding} onClick={() => decide('accepted')}>Accept</Button>
        </div>
      </Modal>

      <Modal open={decideOpen === 'decline'} onClose={() => setDecideOpen(null)} title="Decline kindly">
        <p className="text-sm text-faint">
          A short note softens the landing — edit this or send it as is.
        </p>
        <div className="mt-4">
          <TextAreaField
            label="Message to the student"
            value={declineNote}
            onChange={(e) => setDeclineNote(e.target.value)}
            rows={4}
            maxLength={3000}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDecideOpen(null)}>Cancel</Button>
          <Button variant="secondary" loading={deciding} onClick={() => decide('declined')}>Send & decline</Button>
        </div>
      </Modal>
    </div>
  )
}

function MessageBubble({
  name, mine, staff, time, body, label,
  hidden = false, onModerate, moderating = false, reportable = false, messageId,
}: {
  name: string
  mine: boolean
  staff: boolean
  time: string
  body: string
  label?: string
  /** Staff-removed. Only staff ever see this state — messages_select hides the
   *  row entirely from everyone else. */
  hidden?: boolean
  /** Provided for staff only; toggles hidden_at. */
  onModerate?: () => void
  moderating?: boolean
  reportable?: boolean
  messageId?: string
}) {
  return (
    <div className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={name} size="sm" staff={staff} />
      <div className={`max-w-[80%] min-w-0 ${mine ? 'text-right' : ''}`}>
        <p className="text-xs text-faint">
          {staff ? 'CRMS Staff' : name} · {messageTime(time)}
          {label ? ` · ${label}` : ''}
          {hidden && ' · Removed by staff'}
        </p>
        <div
          className={`mt-1 inline-block whitespace-pre-line rounded-xl px-4 py-2.5 text-left text-sm leading-relaxed ${
            hidden
              ? 'border border-dashed border-input bg-paper text-faint line-through'
              : staff
                ? 'bg-pine text-white'
                : mine
                  ? 'bg-meadow text-ink'
                  : 'border border-line bg-card text-ink'
          }`}
        >
          {body}
        </div>
        {(onModerate || (reportable && messageId)) && (
          <div className={`mt-1 flex items-center gap-3 ${mine ? 'justify-end' : ''}`}>
            {reportable && messageId && (
              <ReportButton target="message" targetId={messageId} label="Flag this message" />
            )}
            {onModerate && (
              <Button variant="ghost" size="sm" loading={moderating} onClick={onModerate}>
                {hidden ? 'Restore message' : 'Remove message'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
