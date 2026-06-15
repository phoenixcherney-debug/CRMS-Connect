import { useEffect, useState } from 'react'
import { Calendar, MapPin, Clock, Plus, X, Users, Trash2, Edit3, ExternalLink, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/ToastProvider'
import { friendlyError } from '../lib/errors'
import { validateExternalUrl, safeExternalHref } from '../lib/url'

interface DBEvent {
  id: string
  created_at: string
  title: string
  description: string | null
  location: string | null
  date: string
  time: string | null
  end_time: string | null
  all_day: boolean
  registration_link: string | null
  capacity: number | null
  type: 'career_fair' | 'networking' | 'workshop' | 'info_session' | 'other'
  host_id: string
  profiles: { full_name: string } | null
}

const EVENT_TYPE_LABELS: Record<DBEvent['type'], string> = {
  career_fair:   'Career Fair',
  networking:    'Networking',
  workshop:      'Workshop',
  info_session:  'Info Session',
  other:         'Other',
}

const EVENT_TYPE_COLORS: Record<DBEvent['type'], string> = {
  career_fair:  'bg-primary-muted text-primary border-primary-muted',
  networking:   'bg-event-networking-bg text-event-networking-text border-event-networking-border',
  workshop:     'bg-event-workshop-bg text-event-workshop-text border-event-workshop-border',
  info_session: 'bg-event-info-bg text-event-info-text border-event-info-border',
  other:        'bg-event-other-bg text-event-other-text border-event-other-border',
}

interface EventForm {
  title: string
  description: string
  location: string
  date: string
  time: string
  end_time: string
  all_day: boolean
  registration_link: string
  capacity: string
  type: DBEvent['type']
}

const BLANK_FORM: EventForm = {
  title: '', description: '', location: '', date: '',
  time: '', end_time: '', all_day: false,
  registration_link: '', capacity: '',
  type: 'networking',
}

export default function Events() {
  const { profile } = useAuth()
  const toast = useToast()
  const isPoster = profile?.role === 'employer_mentor'

  const [events, setEvents] = useState<DBEvent[]>([])
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, number>>({})
  const [myRsvps, setMyRsvps] = useState<Set<string>>(new Set())
  const [rsvpBusy, setRsvpBusy] = useState<string | null>(null)
  const [showMine, setShowMine] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(BLANK_FORM)

  // Edit modal state
  const [editingEvent, setEditingEvent] = useState<DBEvent | null>(null)
  const [editForm, setEditForm] = useState<EventForm>(BLANK_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [{ data }, { data: countsData }, mineRes] = await Promise.all([
      supabase
        .from('events')
        .select('*, profiles!events_host_id_fkey(full_name)')
        .order('date', { ascending: true }),
      supabase.rpc('event_rsvp_counts'),
      profile
        ? supabase.from('event_rsvps').select('event_id').eq('user_id', profile.id)
        : Promise.resolve({ data: [] as { event_id: string }[] }),
    ])
    setEvents((data as DBEvent[]) ?? [])
    const counts: Record<string, number> = {}
    for (const c of (countsData ?? []) as { event_id: string; attendee_count: number }[]) {
      counts[c.event_id] = Number(c.attendee_count)
    }
    setRsvpCounts(counts)
    setMyRsvps(new Set(((mineRes.data ?? []) as { event_id: string }[]).map((r) => r.event_id)))
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  async function toggleRsvp(ev: DBEvent) {
    if (!profile || rsvpBusy) return
    setRsvpBusy(ev.id)
    const going = myRsvps.has(ev.id)
    if (going) {
      const { error } = await supabase.from('event_rsvps').delete().eq('event_id', ev.id).eq('user_id', profile.id)
      setRsvpBusy(null)
      if (error) { toast(friendlyError(error, 'Could not update your RSVP.'), { kind: 'error' }); return }
      setMyRsvps((prev) => { const n = new Set(prev); n.delete(ev.id); return n })
      setRsvpCounts((prev) => ({ ...prev, [ev.id]: Math.max(0, (prev[ev.id] ?? 1) - 1) }))
    } else {
      const { error } = await supabase.from('event_rsvps').insert({ event_id: ev.id, user_id: profile.id })
      setRsvpBusy(null)
      if (error) {
        const full = /full/i.test(error.message ?? '')
        toast(full ? 'This event is full.' : friendlyError(error, 'Could not RSVP.'), { kind: 'error' })
        return
      }
      setMyRsvps((prev) => new Set(prev).add(ev.id))
      setRsvpCounts((prev) => ({ ...prev, [ev.id]: (prev[ev.id] ?? 0) + 1 }))
      toast("You're going!")
    }
  }

  function buildPayload(f: EventForm): { ok: true; payload: Partial<DBEvent> } | { ok: false; error: string } {
    if (!f.title.trim()) return { ok: false, error: 'Title is required.' }
    if (!f.date)         return { ok: false, error: 'Date is required.' }
    if (!f.all_day && !f.time) {
      return { ok: false, error: 'Start time is required (or toggle "All day").' }
    }
    if (!f.all_day && f.end_time && f.end_time <= f.time) {
      return { ok: false, error: 'End time must be after start time.' }
    }
    let regLink: string | null = null
    if (f.registration_link.trim()) {
      const v = validateExternalUrl(f.registration_link.trim())
      if (!v.safe) return { ok: false, error: 'Registration link must be a valid http(s) URL.' }
      regLink = v.safe
    }
    let capNum: number | null = null
    if (f.capacity.trim()) {
      const n = parseInt(f.capacity, 10)
      if (isNaN(n) || n <= 0) return { ok: false, error: 'Capacity must be a positive number.' }
      capNum = n
    }
    return {
      ok: true,
      payload: {
        title: f.title.trim(),
        description: f.description.trim() || null,
        location: f.location.trim() || null,
        date: f.date,
        time: f.all_day ? null : f.time,
        end_time: f.all_day ? null : (f.end_time || null),
        all_day: f.all_day,
        registration_link: regLink,
        capacity: capNum,
        type: f.type,
      },
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setCreateError(null)
    const built = buildPayload(form)
    if (!built.ok) { setCreateError(built.error); return }
    setSubmitting(true)
    const { error } = await supabase.from('events').insert({
      ...built.payload,
      host_id: profile.id,
    })
    setSubmitting(false)
    if (error) {
      setCreateError('Failed to create event. Please try again.')
      return
    }
    setShowForm(false)
    setForm(BLANK_FORM)
    load()
  }

  function openEdit(ev: DBEvent) {
    setEditingEvent(ev)
    setEditForm({
      title: ev.title,
      description: ev.description ?? '',
      location: ev.location ?? '',
      date: ev.date,
      time: ev.time ?? '',
      end_time: ev.end_time ?? '',
      all_day: ev.all_day,
      registration_link: ev.registration_link ?? '',
      capacity: ev.capacity?.toString() ?? '',
      type: ev.type,
    })
    setEditError(null)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEvent) return
    setEditError(null)
    const built = buildPayload(editForm)
    if (!built.ok) { setEditError(built.error); return }
    setEditSubmitting(true)
    const { error } = await supabase.from('events').update(built.payload).eq('id', editingEvent.id)
    setEditSubmitting(false)
    if (error) {
      setEditError('Failed to update event. Please try again.')
      return
    }
    setEditingEvent(null)
    load()
  }

  async function handleDelete(eventId: string) {
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) {
      setDeleteError('Failed to delete event. Please try again.')
      setConfirmDeleteId(null)
      return
    }
    setConfirmDeleteId(null)
    setDeleteError(null)
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  const today = new Date().toISOString().split('T')[0]
  const visible  = showMine ? events.filter((e) => myRsvps.has(e.id)) : events
  const upcoming = visible.filter((e) => e.date >= today)
  const past     = visible.filter((e) => e.date <  today).reverse()

  return (
    <div className="max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>Events</h1>
          <p className="text-ink-secondary text-sm mt-0.5">
            Career fairs, networking nights, workshops & more
          </p>
        </div>
        {isPoster && (
          <button type="button"
            onClick={() => setShowForm(true)}
            className="btn-gold"
          >
            <Plus size={15} /> Add Event
          </button>
        )}
      </div>

      {deleteError && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-bg border border-status-rejected-border text-sm text-error">
          {deleteError}
        </div>
      )}

      {/* My-events filter */}
      <div className="mb-4 flex items-center gap-2 text-xs">
        {([
          { v: false, l: 'All events' },
          { v: true,  l: `My events${myRsvps.size > 0 ? ` (${myRsvps.size})` : ''}` },
        ] as const).map((opt) => (
          <button
            key={String(opt.v)}
            type="button"
            onClick={() => setShowMine(opt.v)}
            className={`px-2.5 py-1 rounded-md border transition-colors ${showMine === opt.v ? 'border-primary bg-primary-muted text-primary' : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
          >
            {opt.l}
          </button>
        ))}
      </div>

      {/* Create event modal */}
      {showForm && (
        <EventModal
          title="Add an Event"
          form={form}
          setForm={setForm}
          today={today}
          submitting={submitting}
          error={createError}
          onSubmit={handleCreate}
          onClose={() => { setShowForm(false); setCreateError(null) }}
          submitLabel={submitting ? 'Adding…' : 'Add Event'}
        />
      )}

      {/* Edit event modal */}
      {editingEvent && (
        <EventModal
          title="Edit Event"
          form={editForm}
          setForm={setEditForm}
          today={today}
          submitting={editSubmitting}
          error={editError}
          onSubmit={handleEdit}
          onClose={() => setEditingEvent(null)}
          submitLabel={editSubmitting ? 'Saving…' : 'Save changes'}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <h3 className="text-base font-semibold text-ink mb-2">Delete this event?</h3>
            <p className="text-sm text-ink-secondary mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-error hover:bg-error/90 text-white font-medium text-sm transition-colors"
              >
                Delete
              </button>
              <button type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No events yet"
          description={
            isPoster
              ? 'Career fairs, networking nights, and workshops will appear here.'
              : 'Career fairs, networking nights, and workshops will appear here. Employers and mentors can add events.'
          }
          ctaLabel={isPoster ? 'Add the first event' : undefined}
          ctaOnClick={isPoster ? () => setShowForm(true) : undefined}
        />
      ) : (
        <>
          {/* Upcoming events */}
          {upcoming.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3">
                Upcoming
              </h2>
              <div className="space-y-3">
                {upcoming.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    canManage={ev.host_id === profile?.id}
                    onEdit={() => openEdit(ev)}
                    onDelete={() => setConfirmDeleteId(ev.id)}
                    attendeeCount={rsvpCounts[ev.id] ?? 0}
                    isGoing={myRsvps.has(ev.id)}
                    rsvpBusy={rsvpBusy === ev.id}
                    canRsvp={!!profile}
                    onToggleRsvp={() => toggleRsvp(ev)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past events */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wider mb-3">Past</h2>
              <div className="space-y-3 opacity-60">
                {past.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    canManage={ev.host_id === profile?.id}
                    onEdit={() => openEdit(ev)}
                    onDelete={() => setConfirmDeleteId(ev.id)}
                    attendeeCount={rsvpCounts[ev.id] ?? 0}
                    isGoing={myRsvps.has(ev.id)}
                    rsvpBusy={false}
                    canRsvp={false}
                    onToggleRsvp={() => {}}
                    isPast
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

    </div>
  )
}

function EventModal({
  title, form, setForm, today, submitting, error, onSubmit, onClose, submitLabel,
}: {
  title: string
  form: EventForm
  setForm: React.Dispatch<React.SetStateAction<EventForm>>
  today: string
  submitting: boolean
  error: string | null
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
  submitLabel: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div
        className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <p className="mb-3 text-sm text-error">{error}</p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Event title <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="CRMS Alumni Career Fair"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Date <span className="text-error">*</span></label>
            <input
              type="date"
              required
              min={today}
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => setForm((f) => ({
                ...f,
                all_day: e.target.checked,
                time: e.target.checked ? '' : f.time,
                end_time: e.target.checked ? '' : f.end_time,
              }))}
              className="rounded border-border text-primary focus:ring-primary/30"
            />
            All day
          </label>

          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Start time <span className="text-error">*</span>
                </label>
                <input
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">End time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Carbondale, CO or Virtual"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DBEvent['type'] }))}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            >
              {(Object.keys(EVENT_TYPE_LABELS) as DBEvent['type'][]).map((t) => (
                <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Registration link</label>
              <input
                type="url"
                value={form.registration_link}
                onChange={(e) => setForm((f) => ({ ...f, registration_link: e.target.value }))}
                placeholder="https://…"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Capacity</label>
              <input
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                placeholder="Max attendees"
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm placeholder:text-ink-placeholder focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
            <textarea
              rows={3}
              maxLength={4000}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What's this event about?"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm
                placeholder:text-ink-placeholder resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!form.title || !form.date || submitting}
              className="btn-gold flex-1"
            >
              {submitting && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EventCard({ event, canManage, onEdit, onDelete, attendeeCount, isGoing, rsvpBusy, canRsvp, onToggleRsvp, isPast = false }: {
  event: DBEvent
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  attendeeCount: number
  isGoing: boolean
  rsvpBusy: boolean
  canRsvp: boolean
  onToggleRsvp: () => void
  isPast?: boolean
}) {
  const spotsLeft = event.capacity != null ? Math.max(0, event.capacity - attendeeCount) : null
  const isFull = spotsLeft === 0 && !isGoing
  const dateObj = new Date(event.date + 'T12:00:00')
  const hostName = event.profiles?.full_name ?? 'Unknown'
  const timeLabel = event.all_day
    ? 'All day'
    : event.end_time
      ? `${event.time}–${event.end_time}`
      : event.time

  return (
    <div
      className="bg-surface rounded-xl border border-border p-5"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary-muted flex flex-col items-center justify-center shrink-0 text-primary">
          <span className="text-[10px] font-semibold uppercase leading-none">
            {dateObj.toLocaleDateString('en-US', { month: 'short' })}
          </span>
          <span className="text-xl font-bold leading-tight">
            {dateObj.getDate()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <p className="font-semibold text-ink">{event.title}</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${EVENT_TYPE_COLORS[event.type]}`}>
                {EVENT_TYPE_LABELS[event.type]}
              </span>
              {canManage && (
                <>
                  <button type="button"
                    onClick={onEdit}
                    className="text-ink-muted hover:text-ink transition-colors"
                    title="Edit event"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button type="button"
                    onClick={onDelete}
                    className="text-ink-muted hover:text-error transition-colors"
                    title="Delete event"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-muted">
            {timeLabel && (
              <span className="flex items-center gap-1"><Clock size={11} />{timeLabel}</span>
            )}
            {event.location && (
              <span className="flex items-center gap-1"><MapPin size={11} />{event.location}</span>
            )}
            {event.capacity != null ? (
              <span className="flex items-center gap-1">
                <Users size={11} />
                {attendeeCount}/{event.capacity} going{spotsLeft != null && spotsLeft > 0 ? ` · ${spotsLeft} left` : ''}
              </span>
            ) : attendeeCount > 0 ? (
              <span className="flex items-center gap-1"><Users size={11} />{attendeeCount} going</span>
            ) : null}
            <span className="flex items-center gap-1">
              <Users size={11} />
              Hosted by {hostName}
            </span>
          </div>
          {event.description && (
            <p className="text-sm text-ink-secondary mt-2 leading-relaxed whitespace-pre-line">{event.description}</p>
          )}
          {event.registration_link && safeExternalHref(event.registration_link) && (
            <a
              href={safeExternalHref(event.registration_link)!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:underline"
            >
              Register / RSVP <ExternalLink size={11} />
            </a>
          )}
          {!isPast && canRsvp && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onToggleRsvp}
                disabled={rsvpBusy || (isFull && !isGoing)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isGoing
                    ? 'border-status-accepted-border bg-success-bg text-success'
                    : 'border-border text-ink-secondary hover:bg-primary-faint'
                }`}
              >
                {isGoing ? <><Check size={13} /> Going — tap to cancel</> : isFull ? 'Event full' : 'RSVP'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
