import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, XCircle, Clock, User, RefreshCw } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

interface MeetingRequest {
  id: string
  created_at: string
  requester_id: string
  recipient_id: string
  slot_id: string | null
  requested_date: string
  requested_start_time: string
  requested_end_time: string
  note: string | null
  status: 'pending' | 'accepted' | 'declined'
  requester: { full_name: string } | null
  recipient: { full_name: string } | null
}

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const STATUS_LABEL: Record<MeetingRequest['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
}
const STATUS_CLASS: Record<MeetingRequest['status'], string> = {
  pending:  'bg-status-pending-bg text-status-pending-text border-status-pending-border',
  accepted: 'bg-success-bg text-success border-status-accepted-border',
  declined: 'bg-error-bg text-error border-status-rejected-border',
}

export default function MeetingRequests() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<MeetingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)

  async function load(quiet = false) {
    if (!profile) return
    if (quiet) setRefreshing(true)
    else setLoading(true)

    const { data } = await supabase
      .from('meeting_requests')
      .select(`
        *,
        requester:profiles!meeting_requests_requester_id_fkey(full_name),
        recipient:profiles!meeting_requests_recipient_id_fkey(full_name)
      `)
      .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })

    setRequests((data as MeetingRequest[]) ?? [])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [profile?.id])

  async function handleAction(id: string, status: 'accepted' | 'declined') {
    setActioning(id)
    const { error } = await supabase
      .from('meeting_requests')
      .update({ status })
      .eq('id', id)
    setActioning(null)
    if (!error) {
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
    }
  }

  async function handleCancel(id: string) {
    setActioning(id)
    const { error } = await supabase.from('meeting_requests').delete().eq('id', id)
    setActioning(null)
    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== id))
    }
  }

  const incoming = requests.filter((r) => r.recipient_id === profile?.id)
  const outgoing = requests.filter((r) => r.requester_id === profile?.id)
  const pendingCount = incoming.filter((r) => r.status === 'pending').length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink flex items-center gap-2" style={{ fontFamily: 'var(--font-serif)' }}>
            Meetings
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-primary text-white text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-ink-secondary text-sm mt-0.5">Meeting requests sent and received</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-8">
          {/* Incoming */}
          <section>
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Incoming requests
              {pendingCount > 0 && <span className="ml-2 text-primary normal-case">{pendingCount} pending</span>}
            </h2>
            {incoming.length === 0 ? (
              <div className="text-center py-10 bg-surface rounded-xl border border-border">
                <Calendar size={28} className="mx-auto text-ink-muted mb-2" />
                <p className="text-sm text-ink-muted">No incoming requests yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incoming.map((req) => (
                  <RequestCard key={req.id} req={req} perspective="incoming"
                    actioning={actioning === req.id}
                    onAccept={() => handleAction(req.id, 'accepted')}
                    onDecline={() => handleAction(req.id, 'declined')}
                    onCancel={() => handleCancel(req.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Outgoing */}
          <section>
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3">
              Sent requests
            </h2>
            {outgoing.length === 0 ? (
              <div className="text-center py-10 bg-surface rounded-xl border border-border">
                <User size={28} className="mx-auto text-ink-muted mb-2" />
                <p className="text-sm text-ink-muted">
                  You haven't sent any meeting requests.{' '}
                  <Link to="/people" className="text-primary hover:text-primary-light">Browse people</Link>{' '}
                  to find someone to connect with.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {outgoing.map((req) => (
                  <RequestCard key={req.id} req={req} perspective="outgoing"
                    actioning={actioning === req.id}
                    onCancel={() => handleCancel(req.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function RequestCard({ req, perspective, actioning, onAccept, onDecline, onCancel }: {
  req: MeetingRequest
  perspective: 'incoming' | 'outgoing'
  actioning: boolean
  onAccept?: () => void
  onDecline?: () => void
  onCancel: () => void
}) {
  const otherName = perspective === 'incoming'
    ? req.requester?.full_name ?? 'Someone'
    : req.recipient?.full_name ?? 'Someone'

  return (
    <div className="bg-surface rounded-xl border border-border p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <User size={14} className="text-ink-muted shrink-0" />
            <span className="text-sm font-medium text-ink">
              {perspective === 'incoming' ? `From ${otherName}` : `To ${otherName}`}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_CLASS[req.status]}`}>
              {STATUS_LABEL[req.status]}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {format(parseISO(req.requested_date), 'EEE, MMM d, yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {fmtTime(req.requested_start_time)} – {fmtTime(req.requested_end_time)}
            </span>
          </div>
          {req.note && (
            <p className="mt-2 text-sm text-ink-secondary leading-relaxed line-clamp-2">{req.note}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      {req.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          {perspective === 'incoming' && (
            <>
              <button
                onClick={onAccept}
                disabled={actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success hover:bg-success/90 text-white text-xs font-medium
                  disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 size={13} />
                {actioning ? 'Saving…' : 'Accept'}
              </button>
              <button
                onClick={onDecline}
                disabled={actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-status-rejected-border bg-error-bg
                  text-error text-xs font-medium disabled:opacity-50 transition-colors hover:bg-error-bg/80"
              >
                <XCircle size={13} />
                Decline
              </button>
            </>
          )}
          {perspective === 'outgoing' && (
            <button
              onClick={onCancel}
              disabled={actioning}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-ink-secondary
                hover:bg-error-bg hover:text-error hover:border-status-rejected-border
                disabled:opacity-50 transition-colors"
            >
              {actioning ? 'Cancelling…' : 'Cancel request'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
