import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MapPin, CalendarRange, Clock3, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { usePageData } from '../../lib/usePageData'
import { setOfferHidden } from '../../lib/mutations'
import { OFFER_POSTER_JOIN_DETAIL } from '../../lib/joins'
import { activeRequestOf, canRaiseHand, posterAvailable } from '../../lib/permissions'
import { useAuth } from '../../contexts/AuthContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { TextAreaField } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { PersonLink } from '../../components/PersonLink'
import { ReportButton } from '../../components/ReportButton'
import { friendlyError } from '../../lib/errors'
import { timeAgo } from '../../lib/format'
import { OFFER_KIND_META, LOCATION_MODE_LABEL, OFFER_STATUS_LABEL, REQUEST_STATUS_META } from '../../types'
import type { Offer, HandRaise, PublicProfile } from '../../types'

type OfferFull = Offer & {
  // Null if the poster has been disabled (RLS hides the profile) — guarded in
  // render so the page degrades instead of white-screening.
  poster:
    | (Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year' | 'organization' | 'title'> & {
        open_to_requests?: boolean
      })
    | null
}

export function OfferDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [offer, setOffer] = useState<OfferFull | null>(null)
  const [myRequest, setMyRequest] = useState<HandRaise | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [moderating, setModerating] = useState(false)

  const load = useCallback(async (isActive: () => boolean) => {
    if (!id || !user) return
    const { data, error } = await supabase
      .from('offers')
      .select(`*, ${OFFER_POSTER_JOIN_DETAIL}`)
      .eq('id', id)
      .maybeSingle()
    if (!isActive()) return
    if (error) {
      setLoadError(friendlyError(error))
      return
    }
    if (!data) {
      setLoadError('This offer is gone — it may have been closed or removed.')
      return
    }
    // Clear on success: without this, one failed detail page kept rendering
    // "This offer is gone" over every healthy offer visited afterwards.
    setLoadError(null)
    setOffer(data)
    if (profile?.role === 'student') {
      const { data: req, error: reqError } = await supabase
        .from('requests')
        .select('*')
        .eq('offer_id', id)
        .eq('student_id', user.id)
        .maybeSingle()
      if (!isActive()) return
      if (reqError) { setLoadError(friendlyError(reqError)); return }
      setMyRequest(req)
    }
  }, [id, user, profile?.role])

  usePageData(load)

  async function raiseHand(e: FormEvent) {
    e.preventDefault()
    if (!user || !id || note.trim().length < 10) return
    setSubmitting(true)
    // Clean re-application: a withdrawn request still occupies the (offer,student)
    // unique slot. Revive that row instead of deleting it — a DELETE cascades
    // messages.request_id and would erase the entire prior staff-readable thread
    // (review blocker). enforce_request_transition allows the student
    // withdrawn → sent and re-checks every gate requests_insert applies.
    const { data, error } =
      myRequest && myRequest.status === 'withdrawn'
        ? await supabase
            .from('requests')
            .update({ status: 'sent', note: note.trim() })
            .eq('id', myRequest.id)
            .select()
            .single()
        : await supabase
            .from('requests')
            .insert({ offer_id: id, student_id: user.id, note: note.trim() })
            .select()
            .single()
    setSubmitting(false)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast('You knocked — they\'ll see your note.')
    navigate(`/requests/${data.id}`)
  }

  async function setHidden(hide: boolean) {
    if (!offer) return
    setModerating(true)
    const { error } = await setOfferHidden(offer.id, hide)
    setModerating(false)
    if (error) {
      toast(friendlyError(error), 'error')
      return
    }
    toast(hide ? 'Offer unlisted from the board.' : 'Offer restored to the board.')
    load(() => true)
  }

  if (loadError) {
    return (
      <Card className="text-center">
        <p className="text-sm text-faint">{loadError}</p>
        <Link to="/board" className="mt-4 inline-block text-sm text-pine hover:underline">Back to the board</Link>
      </Card>
    )
  }
  if (!offer || !profile) return <Spinner page />

  const kind = OFFER_KIND_META[offer.kind]
  const isOwner = offer.posted_by === profile.id
  const isAdmin = profile.role === 'admin'
  const isStudent = profile.role === 'student'
  // A withdrawn request frees the door to be knocked on again (review C-04).
  const activeRequest = activeRequestOf(myRequest)
  // Null poster (RLS-hidden because they're disabled) counts as unavailable,
  // not as "not paused" — see posterAvailable.
  const posterUnavailable = !posterAvailable(offer.poster)
  const canRaise = canRaiseHand({
    viewerRole: profile.role,
    offerStatus: offer.status,
    offerHidden: !!offer.hidden_at,
    poster: offer.poster,
    hasActiveRequest: !!activeRequest,
  })

  const facts: { icon: typeof MapPin; text: string }[] = [
    { icon: MapPin, text: offer.location_text || LOCATION_MODE_LABEL[offer.location_mode] },
    ...(offer.timeframe ? [{ icon: CalendarRange, text: offer.timeframe }] : []),
    ...(offer.commitment ? [{ icon: Clock3, text: offer.commitment }] : []),
    { icon: Users, text: offer.spots === 1 ? 'One spot' : `${offer.spots} spots` },
  ]

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/board" className="text-sm text-faint hover:text-ink">← The Board</Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tint={kind.tint}>{kind.label}</Badge>
        {offer.status !== 'open' && <Badge>{OFFER_STATUS_LABEL[offer.status]}</Badge>}
        {offer.hidden_at && <Badge tint="bg-clay-soft text-clay-deep">Unlisted by staff</Badge>}
        <span className="ml-auto text-xs text-faint">Posted {timeAgo(offer.created_at)}</span>
      </div>

      <h1 className="mt-3 text-3xl leading-tight">{offer.title}</h1>

      <div className="mt-5">
        <PersonLink
          person={offer.poster}
          sub={offer.poster ? [offer.poster.title, offer.poster.organization].filter(Boolean).join(', ') || null : null}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        {facts.map(({ icon: Icon, text }) => (
          <span key={text} className="inline-flex items-center gap-1.5 text-sm text-faint">
            <Icon className="h-4 w-4" aria-hidden /> {text}
          </span>
        ))}
      </div>

      <div className="mt-6 whitespace-pre-line text-base leading-relaxed text-ink">
        {offer.description}
      </div>

      {/* Owner / staff controls */}
      {(isOwner || isAdmin) && (
        <Card className="mt-8" padded>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && (
              <>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/offers/${offer.id}/manage`)}>
                  See who's knocked
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`/offers/${offer.id}/edit`)}>
                  Edit
                </Button>
              </>
            )}
            {isAdmin && !isOwner && (
              <>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/offers/${offer.id}/manage`)}>
                  View requests (staff)
                </Button>
                <Button
                  variant={offer.hidden_at ? 'secondary' : 'danger'}
                  size="sm"
                  loading={moderating}
                  onClick={() => setHidden(!offer.hidden_at)}
                >
                  {offer.hidden_at ? 'Restore to board' : 'Unlist from board'}
                </Button>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Student action */}
      {isStudent && (
        <div className="mt-8">
          {activeRequest ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">You knocked {timeAgo(activeRequest.created_at)}</p>
                  <p className="mt-1 text-sm text-faint">{REQUEST_STATUS_META[activeRequest.status].student}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate(`/requests/${activeRequest.id}`)}>
                  Open the thread
                </Button>
              </div>
            </Card>
          ) : canRaise ? (
            <Card>
              <h2 className="text-xl">Knock on the door</h2>
              <p className="mt-1 text-sm text-faint">
                A few honest sentences beat a formal cover letter. Why this door, why you?
                CRMS staff can see this too.
              </p>
              <form onSubmit={raiseHand} className="mt-4 space-y-4">
                <TextAreaField
                  label="Your note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={5}
                  minLength={10}
                  maxLength={1500}
                  placeholder="Hi — I'm interested because…"
                  required
                />
                <Button type="submit" variant="accent" size="lg" loading={submitting} disabled={note.trim().length < 10}>
                  Knock on the door
                </Button>
              </form>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-faint">
                {posterUnavailable
                  ? 'This member is taking a pause from new requests right now.'
                  : offer.status === 'filled'
                    ? 'This door has been filled — but new ones open all the time.'
                    : 'This offer isn\'t taking new knocks right now.'}
              </p>
            </Card>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-end">
        <ReportButton target="offer" targetId={offer.id} />
      </div>
    </div>
  )
}
