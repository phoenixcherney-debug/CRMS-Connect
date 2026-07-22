import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
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
  // Either party's profile join can be null once they're disabled (RLS hides
  // the row) while the thread itself stays visible to the other participant.
  offer: Offer & { poster: PersonLite | null }
  student: PersonLite | null
}

const DECLINE_TEMPLATE =
  'Thanks for raising your hand — I\'ve already filled this one, but I\'m glad you went for it. Keep an eye on the board.'

/** The request thread: student + poster + staff, scoped to one hand-raise.
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
  const bottomRef = useRef<HTMLDivElement>(null)
  const firstLoad = useRef(true)
  // Once the thread has loaded once, background poll failures must not blow away
  // the rendered thread (and the composer + the student's in-progress draft).
  const hasLoaded = useRef(false)

  const load = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('requests')
      .select(`*,
        offer:offers!requests_offer_id_fkey(*, poster:profiles!offers_posted_by_fkey(id, full_name, role, affiliation, class_year, organization)),
        student:profiles!requests_student_id_fkey(id, full_name, role, affiliation, class_year, organization)`)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      // Only surface a full-page error before the first successful load.
      if (!hasLoaded.current) setLoadError(friendlyError(error))
      return
    }
    if (!data) {
      if (!hasLoaded.current) setLoadError('This thread doesn\'t exist, or you\'re not part of it.')
      return
    }
    const { data: msgs, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('request_id', id)
      .order('created_at', { ascending: true })
    if (msgError) {
      if (!hasLoaded.current) setLoadError(friendlyError(msgError))
      return
    }
    setThread(data as unknown as ThreadData)
    setMessages(msgs ?? [])
    setLoadError(null)
    hasLoaded.current = true
  }, [id])

  usePageData(load, 15_000)

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

  const isStudent = profile.id === thread.student_id
  const isPoster = profile.id === thread.offer.posted_by
  const isAdmin = profile.role === 'admin'
  const status = REQUEST_STATUS_META[thread.status]
  const canMessage = ['sent', 'in_conversation', 'accepted'].includes(thread.status) && (isStudent || isPoster || isAdmin)
  const posterCanDecide = (isPoster || isAdmin) && ['sent', 'in_conversation'].includes(thread.status)
  const studentCanWithdraw = isStudent && ['sent', 'in_conversation'].includes(thread.status)
  const otherParty: PersonLite | null = isStudent ? thread.offer.poster : thread.student
  const studentName = personName(thread.student)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!profile || !thread || !body.trim()) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      request_id: thread.id,
      sender_id: profile.id,
      body: body.trim(),
    })
    if (!error && isPoster && thread.status === 'sent') {
      // First reply from the poster moves the request into conversation.
      await supabase.from('requests').update({ status: 'in_conversation' }).eq('id', thread.id)
    }
    setSending(false)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    setBody('')
    load()
  }

  async function decide(status: 'accepted' | 'declined') {
    if (!thread || !profile) return
    setDeciding(true)
    if (status === 'declined' && declineNote.trim()) {
      await supabase.from('messages').insert({
        request_id: thread.id,
        sender_id: profile.id,
        body: declineNote.trim(),
      })
    }
    const { error } = await supabase.from('requests').update({ status }).eq('id', thread.id)
    setDeciding(false)
    setDecideOpen(null)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(status === 'accepted' ? 'Accepted — the thread stays open to sort out details.' : 'Declined kindly.')
    load()
  }

  async function withdraw() {
    if (!thread) return
    const { error } = await supabase.from('requests').update({ status: 'withdrawn' }).eq('id', thread.id)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast('Request withdrawn.')
    load()
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={isStudent ? '/requests' : isPoster ? `/offers/${thread.offer_id}/manage` : '/admin/requests'}
        className="text-sm text-faint hover:text-ink"
      >
        ← {isStudent ? 'My requests' : isPoster ? 'Your offer' : 'All requests'}
      </Link>

      <Card className="mt-4" padded>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-faint">{OFFER_KIND_META[thread.offer.kind].label}</p>
            <Link to={`/board/${thread.offer_id}`} className="mt-1 block text-lg font-display font-semibold leading-snug text-ink hover:text-pine">
              {thread.offer.title}
            </Link>
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
              <Button size="sm" variant="ghost" onClick={withdraw}>Withdraw my hand-raise</Button>
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

      {/* The student's original note opens the thread. */}
      <div className="mt-6 space-y-4">
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
            name={m.sender_id === thread.student_id ? studentName : m.is_staff ? 'CRMS Staff' : personName(thread.offer.poster)}
            mine={m.sender_id === profile.id}
            staff={m.is_staff}
            time={m.created_at}
            body={m.body}
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
          {thread.offer.spots === 1 ? ' This fills your offer and takes it off the open board.' : ''}
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

function MessageBubble({ name, mine, staff, time, body, label }: {
  name: string
  mine: boolean
  staff: boolean
  time: string
  body: string
  label?: string
}) {
  return (
    <div className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={name} size="sm" staff={staff} />
      <div className={`max-w-[80%] min-w-0 ${mine ? 'text-right' : ''}`}>
        <p className="text-xs text-faint">
          {staff ? 'CRMS Staff' : name} · {messageTime(time)}
          {label ? ` · ${label}` : ''}
        </p>
        <div
          className={`mt-1 inline-block whitespace-pre-line rounded-xl px-4 py-2.5 text-left text-sm leading-relaxed ${
            staff ? 'bg-pine text-white' : mine ? 'bg-meadow text-ink' : 'border border-line bg-card text-ink'
          }`}
        >
          {body}
        </div>
      </div>
    </div>
  )
}
