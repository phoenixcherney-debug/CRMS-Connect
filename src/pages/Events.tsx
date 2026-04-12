import { useEffect, useState } from 'react'
import { Calendar, MapPin, Clock, Plus, X, Users, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Spinner from '../components/Spinner'

interface DBEvent {
  id: string
  created_at: string
  title: string
  description: string | null
  location: string | null
  date: string
  time: string | null
  type: 'career_fair' | 'networking' | 'workshop' | 'info_session' | 'other'
  host_id: string
  host_name: string
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

export default function Events() {
  const { profile } = useAuth()
  const isPoster = profile?.role === 'employer_mentor'

  const [events, setEvents] = useState<DBEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    time: '',
    type: 'networking' as DBEvent['type'],
  })

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true })
    setEvents((data as DBEvent[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSubmitting(true)

    const { error } = await supabase.from('events').insert({
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      date: form.date,
      time: form.time || null,
      type: form.type,
      host_id: profile.id,
      host_name: profile.full_name,
    })

    setSubmitting(false)
    if (!error) {
      setShowForm(false)
      setForm({ title: '', description: '', location: '', date: '', time: '', type: 'networking' })
      load()
    }
  }

  async function handleDelete(eventId: string) {
    await supabase.from('events').delete().eq('id', eventId)
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = events.filter((e) => e.date >= today)
  const past     = events.filter((e) => e.date <  today).reverse()

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
          <button
            onClick={() => setShowForm(true)}
            className="btn-gold"
          >
            <Plus size={15} /> Add Event
          </button>
        )}
      </div>

      {/* Create event form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className="bg-surface rounded-2xl border border-border p-6 max-w-md w-full"
            style={{ boxShadow: 'var(--shadow-modal)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-ink">Add an Event</h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-primary-faint transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Time</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>
              </div>

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

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Description</label>
                <textarea
                  rows={3}
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
                  {submitting ? 'Adding…' : 'Add Event'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface rounded-2xl border border-border p-6 max-w-sm w-full" style={{ boxShadow: 'var(--shadow-modal)' }}>
            <h3 className="text-base font-semibold text-ink mb-2">Delete this event?</h3>
            <p className="text-sm text-ink-secondary mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null) }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-error hover:bg-error/90 text-white font-medium text-sm transition-colors"
              >
                Delete
              </button>
              <button
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
        <div className="text-center py-20 bg-surface rounded-2xl border border-border">
          <Calendar size={40} className="mx-auto text-ink-muted mb-4" />
          <h2 className="text-lg font-semibold text-ink mb-2">No events yet</h2>
          <p className="text-ink-muted text-sm max-w-xs mx-auto leading-relaxed">
            Career fairs, alumni networking nights, and workshops will appear here.
          </p>
          {isPoster ? (
            <button
              onClick={() => setShowForm(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg
                border border-primary text-primary hover:bg-primary-muted text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Add the first event
            </button>
          ) : (
            <p className="mt-4 text-xs text-ink-muted">
              Alumni and parents can add events to this page.
            </p>
          )}
        </div>
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
                    canDelete={ev.host_id === profile?.id}
                    onDelete={() => setConfirmDeleteId(ev.id)}
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
                    canDelete={ev.host_id === profile?.id}
                    onDelete={() => setConfirmDeleteId(ev.id)}
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

function EventCard({ event, canDelete, onDelete }: { event: DBEvent; canDelete: boolean; onDelete: () => void }) {
  const dateObj = new Date(event.date + 'T12:00:00')

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
              {canDelete && (
                <button
                  onClick={onDelete}
                  className="text-ink-muted hover:text-error transition-colors"
                  title="Delete event"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-ink-muted">
            {event.time && (
              <span className="flex items-center gap-1"><Clock size={11} />{event.time}</span>
            )}
            {event.location && (
              <span className="flex items-center gap-1"><MapPin size={11} />{event.location}</span>
            )}
            <span className="flex items-center gap-1">
              <Users size={11} />
              Hosted by {event.host_name}
            </span>
          </div>
          {event.description && (
            <p className="text-sm text-ink-secondary mt-2 leading-relaxed">{event.description}</p>
          )}
        </div>
      </div>
    </div>
  )
}
