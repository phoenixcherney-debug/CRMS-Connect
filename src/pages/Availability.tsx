import { useState, useEffect, type ReactNode } from 'react'
import {
  Plus, ChevronLeft, ChevronRight, X, Trash2,
  Calendar, List, LayoutGrid, Clock, AlertCircle, Repeat,
} from 'lucide-react'
import {
  format, parseISO, addDays, addWeeks, addMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  isAfter, isBefore, isSameMonth,
} from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailSlot {
  id: string
  user_id: string
  title: string | null
  date: string
  start_time: string
  end_time: string
  is_recurring: boolean
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | null
  recurrence_end_date: string | null
  created_at: string
}

interface Occ { slot: AvailSlot; date: string }
type View = 'month' | 'week' | 'day' | 'agenda'

// ─── Constants ────────────────────────────────────────────────────────────────

const HR_H = 56                                    // px per hour in grid
const HR_S = 7, HR_E = 21                          // visible range: 7 AM – 9 PM
const HOURS = Array.from({ length: HR_E - HR_S }, (_, i) => HR_S + i)
const GRID_H = (HR_E - HR_S) * HR_H               // total grid height px

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toStr = (d: Date) => format(d, 'yyyy-MM-dd')
const TODAY = toStr(new Date())

function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Expand a slot into all occurrence dates within [from, to]. */
function expandSlot(slot: AvailSlot, from: Date, to: Date): string[] {
  const anchor = parseISO(slot.date)
  if (!slot.is_recurring) {
    return !isBefore(anchor, from) && !isAfter(anchor, to) ? [slot.date] : []
  }
  const until = slot.recurrence_end_date
    ? parseISO(slot.recurrence_end_date)
    : addMonths(new Date(), 13) // look ahead 13 months max for indefinite

  const dates: string[] = []
  let cur = anchor
  let iterations = 0
  while (!isAfter(cur, until) && !isAfter(cur, to) && iterations < 500) {
    iterations++
    if (!isBefore(cur, from)) dates.push(toStr(cur))
    if (slot.recurrence_pattern === 'daily')        cur = addDays(cur, 1)
    else if (slot.recurrence_pattern === 'weekly')  cur = addWeeks(cur, 1)
    else if (slot.recurrence_pattern === 'monthly') cur = addMonths(cur, 1)
    else break
  }
  return dates
}

function getOccs(slots: AvailSlot[], from: Date, to: Date): Occ[] {
  const out: Occ[] = []
  for (const s of slots) for (const d of expandSlot(s, from, to)) out.push({ slot: s, date: d })
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.slot.start_time.localeCompare(b.slot.start_time))
}

/** Generate time select options at 15-minute intervals. */
const TIME_OPTS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15
  const v = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  const ampm = h >= 12 ? 'PM' : 'AM'
  return { v, l: `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}` }
})

const INPUT_CLS = 'w-full px-3 py-2 rounded-lg border border-border bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

// ─── SlotModal ─────────────────────────────────────────────────────────────────

function SlotModal({
  slot, initDate, onClose, onSaved, onDeleted,
}: {
  slot: AvailSlot | null     // null = new slot
  initDate: string
  onClose: () => void
  onSaved: (s: AvailSlot) => void
  onDeleted: (id: string) => void
}) {
  const { profile } = useAuth()
  const [title, setTitle]       = useState(slot?.title ?? '')
  const [date, setDate]         = useState(slot?.date ?? initDate)
  const [st, setSt]             = useState(slot?.start_time?.slice(0, 5) ?? '09:00')
  const [et, setEt]             = useState(slot?.end_time?.slice(0, 5) ?? '10:00')
  const [recurring, setRecurring] = useState(slot?.is_recurring ?? false)
  const [pattern, setPattern]   = useState<'daily' | 'weekly' | 'monthly'>(slot?.recurrence_pattern ?? 'weekly')
  const [endDate, setEndDate]   = useState(slot?.recurrence_end_date ?? '')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr]           = useState<string | null>(null)

  const endOpts = TIME_OPTS.filter(o => o.v > st)

  async function save() {
    if (!profile) return
    if (et <= st) { setErr('End time must be after start time.'); return }
    setSaving(true); setErr(null)
    const payload = {
      user_id: profile.id,
      title: title.trim() || null,
      date, start_time: st, end_time: et,
      is_recurring: recurring,
      recurrence_pattern: recurring ? pattern : null,
      recurrence_end_date: recurring && endDate ? endDate : null,
    }
    const q = slot
      ? supabase.from('availability_slots').update(payload).eq('id', slot.id).select().single()
      : supabase.from('availability_slots').insert(payload).select().single()
    const { data, error } = await q
    setSaving(false)
    if (error) { setErr(error.message); return }
    onSaved(data as AvailSlot)
  }

  async function del() {
    if (!slot) return
    setDeleting(true)
    await supabase.from('availability_slots').delete().eq('id', slot.id)
    setDeleting(false)
    onDeleted(slot.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl border border-border p-5 w-full max-w-sm max-h-[92vh] overflow-y-auto"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink">{slot ? 'Edit Slot' : 'Add Slot'}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3.5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-ink mb-1">
              Title <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Open for coffee chat"
              className={INPUT_CLS}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={INPUT_CLS} />
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-ink mb-1">Start time</label>
              <select value={st} onChange={e => setSt(e.target.value)} className={INPUT_CLS}>
                {TIME_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-ink mb-1">End time</label>
              <select value={et} onChange={e => setEt(e.target.value)} className={INPUT_CLS}>
                {endOpts.length ? endOpts.map(o => <option key={o.v} value={o.v}>{o.l}</option>) : (
                  <option value={et}>{fmtTime(et)}</option>
                )}
              </select>
            </div>
          </div>

          {/* Recurring toggle */}
          <div className="flex items-center gap-3 py-0.5">
            <button
              type="button"
              onClick={() => setRecurring(r => !r)}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none
                ${recurring ? 'bg-primary' : 'bg-border'}`}
              aria-label="Toggle recurring"
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
                ${recurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-ink flex items-center gap-1.5">
              <Repeat size={13} className="text-ink-muted" />
              Recurring
            </span>
          </div>

          {recurring && (
            <>
              {/* Pattern */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1.5">Repeats</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['daily', 'weekly', 'monthly'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPattern(p)}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize
                        ${pattern === p
                          ? 'bg-primary-muted border-primary text-primary'
                          : 'border-border text-ink-secondary hover:bg-primary-faint'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* End date */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  End date{' '}
                  <span className="text-ink-muted font-normal">(leave blank to repeat indefinitely)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={date}
                  onChange={e => setEndDate(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>

              {/* Open-ended recurring warning */}
              {!endDate && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-status-pending-bg border border-status-pending-border text-xs text-status-pending-text">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  This event will repeat indefinitely. Set an end date if you want it to stop.
                </div>
              )}
            </>
          )}

          {/* Visibility tip */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary-faint border border-border text-xs text-ink-muted">
            <AlertCircle size={13} className="shrink-0 mt-0.5 text-primary" />
            Students who view your profile can see your upcoming slots and request meetings.
          </div>

          {err && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-error-bg border border-status-rejected-border text-sm text-error">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {err}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {saving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
            {slot && (
              <button
                onClick={del}
                disabled={deleting}
                className="px-3 py-2.5 rounded-lg border border-error/40 text-error hover:bg-error-bg text-sm transition-colors disabled:opacity-50"
                title="Delete slot"
              >
                {deleting ? '…' : <Trash2 size={15} />}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({ slots, currentDate, onDayClick, onSlotClick }: {
  slots: AvailSlot[]
  currentDate: Date
  onDayClick: (d: Date) => void
  onSlotClick: (s: AvailSlot) => void
}) {
  const mStart = startOfMonth(currentDate)
  const mEnd   = endOfMonth(currentDate)
  const calStart = startOfWeek(mStart, { weekStartsOn: 1 })
  const calEnd   = endOfWeek(mEnd,   { weekStartsOn: 1 })
  const days: Date[] = []
  let d = calStart
  while (!isAfter(d, calEnd)) { days.push(d); d = addDays(d, 1) }

  const monthOccs = getOccs(slots, calStart, calEnd)

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-surface">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(lbl => (
          <div key={lbl} className="py-2 text-center text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
            {lbl}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const ds = toStr(day)
          const inMonth = isSameMonth(day, currentDate)
          const isT = ds === TODAY
          const dayOccs = monthOccs.filter(o => o.date === ds)
          const visible = dayOccs.slice(0, 2)
          const extra   = dayOccs.length - visible.length
          const isLast  = i >= days.length - 7

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={`min-h-[80px] p-1.5 cursor-pointer transition-colors
                border-b border-r border-border
                ${i % 7 === 6 ? 'border-r-0' : ''}
                ${isLast ? 'border-b-0' : ''}
                ${inMonth ? 'hover:bg-primary-faint' : 'opacity-40'}`}
            >
              {/* Day number */}
              <div className="flex justify-start mb-1">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[13px] font-medium
                    ${isT ? 'text-white font-bold' : inMonth ? 'text-ink' : 'text-ink-muted'}`}
                  style={isT ? { backgroundColor: 'var(--color-primary)' } : {}}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Slot pills */}
              <div className="space-y-0.5">
                {visible.map(o => (
                  <div
                    key={`${o.slot.id}-${o.date}`}
                    onClick={e => { e.stopPropagation(); onSlotClick(o.slot) }}
                    className="text-white text-[9px] font-medium px-1.5 py-0.5 rounded truncate leading-tight"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    title={o.slot.title ?? 'Available'}
                  >
                    {fmtTime(o.slot.start_time)}{o.slot.title ? ` · ${o.slot.title}` : ''}
                  </div>
                ))}
                {extra > 0 && (
                  <p className="text-[9px] text-ink-muted px-1">+{extra} more</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Time Grid (shared by Week and Day views) ─────────────────────────────────

function TimeGrid({ dayColumns, onSlotClick }: {
  dayColumns: { label: ReactNode; isToday: boolean; occs: Occ[] }[]
  onSlotClick: (s: AvailSlot) => void
}) {
  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-surface">
      {/* Day header row */}
      <div className="flex border-b border-border" style={{ paddingLeft: 52 }}>
        {dayColumns.map((col, i) => (
          <div
            key={i}
            className={`flex-1 py-2.5 text-center border-l border-border ${i === 0 ? 'border-l-0' : ''}`}
          >
            {col.label}
          </div>
        ))}
      </div>

      {/* Scrollable grid body */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: dayColumns.length === 1 ? 260 : 520 }}>
          <div className="overflow-y-auto" style={{ maxHeight: 504 }}>
            <div className="flex" style={{ height: GRID_H }}>
              {/* Hour labels */}
              <div className="flex flex-col shrink-0" style={{ width: 52 }}>
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="shrink-0 text-right pr-2 text-[11px] text-ink-muted select-none"
                    style={{ height: HR_H, paddingTop: 3 }}
                  >
                    {h % 12 || 12}{h < 12 ? 'am' : 'pm'}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {dayColumns.map((col, ci) => (
                <div
                  key={ci}
                  className="relative flex-1 border-l border-border"
                  style={{ minWidth: 0 }}
                >
                  {/* Hour lines */}
                  {HOURS.map(h => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 border-t border-border/50"
                      style={{ top: (h - HR_S) * HR_H }}
                    />
                  ))}
                  {/* Half-hour dashed lines */}
                  {HOURS.map(h => (
                    <div
                      key={`hh${h}`}
                      className="absolute left-0 right-0 border-t border-border/25"
                      style={{ top: (h - HR_S) * HR_H + HR_H / 2, borderStyle: 'dashed' }}
                    />
                  ))}

                  {/* Slot blocks */}
                  {col.occs.map(o => {
                    const startMin = timeToMin(o.slot.start_time)
                    const endMin   = timeToMin(o.slot.end_time)
                    const top    = Math.max(0, (startMin - HR_S * 60)) / 60 * HR_H
                    const height = Math.max(18, (endMin - startMin) / 60 * HR_H - 2)
                    return (
                      <div
                        key={`${o.slot.id}-${o.date}`}
                        onClick={() => onSlotClick(o.slot)}
                        className="absolute rounded-md overflow-hidden cursor-pointer hover:brightness-110 transition-all"
                        style={{
                          top: top + 1,
                          height,
                          left: 2,
                          right: 2,
                          backgroundColor: 'var(--color-primary)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                      >
                        <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
                          <p className="text-white text-[10px] font-semibold truncate leading-tight">
                            {o.slot.title ?? 'Available'}
                          </p>
                          {height >= 28 && (
                            <p className="text-white/75 text-[9px] truncate leading-tight">
                              {fmtTime(o.slot.start_time)}–{fmtTime(o.slot.end_time)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ slots, currentDate, onSlotClick }: {
  slots: AvailSlot[]
  currentDate: Date
  onSlotClick: (s: AvailSlot) => void
}) {
  const wStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(wStart, i))
  const wOccs = getOccs(slots, wStart, addDays(wStart, 6))

  const cols = days.map((day): { label: ReactNode; isToday: boolean; occs: Occ[] } => {
    const ds = toStr(day)
    const isT = ds === TODAY
    return {
      label: (
        <>
          <p className="text-[11px] text-ink-muted uppercase">{format(day, 'EEE')}</p>
          <p
            className={`text-sm font-bold mt-0.5 mx-auto w-7 h-7 flex items-center justify-center rounded-full
              ${isT ? 'text-white' : 'text-ink'}`}
            style={isT ? { backgroundColor: 'var(--color-primary)' } : {}}
          >
            {format(day, 'd')}
          </p>
        </>
      ),
      isToday: isT,
      occs: wOccs.filter(o => o.date === ds),
    }
  })

  return <TimeGrid dayColumns={cols} onSlotClick={onSlotClick} />
}

// ─── Day View ─────────────────────────────────────────────────────────────────

function DayView({ slots, currentDate, onSlotClick }: {
  slots: AvailSlot[]
  currentDate: Date
  onSlotClick: (s: AvailSlot) => void
}) {
  const ds = toStr(currentDate)
  const dayOccs = getOccs(slots, currentDate, currentDate)

  const isT = ds === TODAY
  const cols: { label: ReactNode; isToday: boolean; occs: Occ[] }[] = [{
    label: (
      <>
        <p className="text-[11px] text-ink-muted uppercase">{format(currentDate, 'EEEE')}</p>
        <p
          className={`text-lg font-bold mt-0.5 mx-auto w-9 h-9 flex items-center justify-center rounded-full
            ${isT ? 'text-white' : 'text-ink'}`}
          style={isT ? { backgroundColor: 'var(--color-primary)' } : {}}
        >
          {format(currentDate, 'd')}
        </p>
        <p className="text-[11px] text-ink-muted">{format(currentDate, 'MMMM yyyy')}</p>
      </>
    ),
    isToday: isT,
    occs: dayOccs,
  }]

  return <TimeGrid dayColumns={cols} onSlotClick={onSlotClick} />
}

// ─── Agenda View ──────────────────────────────────────────────────────────────

function AgendaView({ slots, onSlotClick }: {
  slots: AvailSlot[]
  onSlotClick: (s: AvailSlot) => void
}) {
  const from = new Date()
  const to   = addMonths(from, 3)
  const items = getOccs(slots, from, to)

  const grouped = new Map<string, Occ[]>()
  for (const o of items) {
    if (!grouped.has(o.date)) grouped.set(o.date, [])
    grouped.get(o.date)!.push(o)
  }
  const dates = Array.from(grouped.keys()).sort()

  if (dates.length === 0) {
    return (
      <div className="text-center py-16 bg-surface rounded-2xl border border-border">
        <Calendar size={36} className="mx-auto text-ink-muted mb-3" />
        <p className="text-ink-muted text-sm font-medium">No upcoming slots in the next 3 months.</p>
        <p className="text-ink-muted text-xs mt-1">Add a slot to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {dates.map(ds => {
        const day = parseISO(ds)
        const isT = ds === TODAY
        const dayOccs = grouped.get(ds)!

        return (
          <div
            key={ds}
            className="bg-surface rounded-2xl border border-border overflow-hidden"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            {/* Date header */}
            <div
              className="px-4 py-2.5 border-b border-border flex items-center gap-2"
              style={isT ? { backgroundColor: 'var(--color-primary-faint)' } : {}}
            >
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-primary)' }} />
              <p className={`text-sm font-semibold ${isT ? 'text-primary' : 'text-ink'}`}>
                {isT ? 'Today — ' : ''}{format(day, 'EEEE, MMMM d, yyyy')}
              </p>
            </div>

            {/* Slot rows */}
            <div className="divide-y divide-border">
              {dayOccs.map(o => (
                <div
                  key={`${o.slot.id}-${o.date}`}
                  onClick={() => onSlotClick(o.slot)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-primary-faint cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}
                    >
                      <Clock size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{o.slot.title ?? 'Available'}</p>
                      <p className="text-xs text-ink-secondary">{fmtTime(o.slot.start_time)} – {fmtTime(o.slot.end_time)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {o.slot.is_recurring && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium capitalize"
                        style={{ backgroundColor: 'var(--color-primary-muted)', color: 'var(--color-primary)' }}
                      >
                        <Repeat size={9} />
                        {o.slot.recurrence_pattern}
                      </span>
                    )}
                    <ChevronRight size={14} className="text-ink-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const VIEWS: { key: View; label: string; icon: typeof Calendar }[] = [
  { key: 'month',  label: 'Month',  icon: LayoutGrid },
  { key: 'week',   label: 'Week',   icon: Calendar   },
  { key: 'day',    label: 'Day',    icon: Clock      },
  { key: 'agenda', label: 'Agenda', icon: List       },
]

export default function Availability() {
  const { profile } = useAuth()
  const [slots, setSlots]           = useState<AvailSlot[]>([])
  const [loading, setLoading]       = useState(true)
  const [view, setView]             = useState<View>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showModal, setShowModal]   = useState(false)
  const [editingSlot, setEditingSlot] = useState<AvailSlot | null>(null)
  const [initDate, setInitDate]     = useState(TODAY)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('availability_slots')
      .select('*')
      .eq('user_id', profile.id)
      .order('date', { ascending: true })
      .then(({ data }) => {
        setSlots((data as AvailSlot[]) ?? [])
        setLoading(false)
      })
  }, [profile?.id])

  function openNew(date?: string) {
    setInitDate(date ?? TODAY)
    setEditingSlot(null)
    setShowModal(true)
  }

  function openEdit(slot: AvailSlot) {
    setEditingSlot(slot)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingSlot(null)
  }

  function handleSaved(saved: AvailSlot) {
    setSlots(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      return idx >= 0 ? prev.map((s, i) => i === idx ? saved : s) : [...prev, saved]
    })
    closeModal()
  }

  function handleDeleted(id: string) {
    setSlots(prev => prev.filter(s => s.id !== id))
    closeModal()
  }

  // Navigation
  function navPrev() {
    if (view === 'month') setCurrentDate(d => addMonths(d, -1))
    else if (view === 'week') setCurrentDate(d => addWeeks(d, -1))
    else setCurrentDate(d => addDays(d, -1))
  }
  function navNext() {
    if (view === 'month') setCurrentDate(d => addMonths(d, 1))
    else if (view === 'week') setCurrentDate(d => addWeeks(d, 1))
    else setCurrentDate(d => addDays(d, 1))
  }

  function navLabel(): string {
    if (view === 'month') return format(currentDate, 'MMMM yyyy')
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
      const we = addDays(ws, 6)
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
    }
    if (view === 'day') return format(currentDate, 'EEEE, MMMM d, yyyy')
    return 'Upcoming'
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
          My Availability
        </h1>
        <button onClick={() => openNew()} className="btn-gold shrink-0">
          <Plus size={15} /> Add Slot
        </button>
      </div>

      {/* ── Controls row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        {/* View switcher */}
        <div
          className="flex gap-1 p-1 rounded-xl border border-border bg-surface shrink-0"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${view === key
                  ? 'text-white'
                  : 'text-ink-secondary hover:text-ink hover:bg-primary-faint'}`}
              style={view === key ? { backgroundColor: 'var(--color-primary)' } : {}}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Date navigation (hidden for agenda) */}
        {view !== 'agenda' && (
          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            <div className="flex items-center gap-1">
              <button
                onClick={navPrev}
                className="p-1.5 rounded-lg border border-border hover:bg-primary-faint transition-colors text-ink-secondary"
                aria-label="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1 rounded-lg border border-border text-sm text-ink-secondary hover:bg-primary-faint transition-colors"
              >
                Today
              </button>
              <button
                onClick={navNext}
                className="p-1.5 rounded-lg border border-border hover:bg-primary-faint transition-colors text-ink-secondary"
                aria-label="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="text-sm font-semibold text-ink">{navLabel()}</span>
          </div>
        )}
      </div>

      {/* ── Calendar body ── */}
      {view === 'month' && (
        <MonthView
          slots={slots}
          currentDate={currentDate}
          onDayClick={d => { setCurrentDate(d); setView('day') }}
          onSlotClick={openEdit}
        />
      )}
      {view === 'week' && (
        <WeekView slots={slots} currentDate={currentDate} onSlotClick={openEdit} />
      )}
      {view === 'day' && (
        <DayView slots={slots} currentDate={currentDate} onSlotClick={openEdit} />
      )}
      {view === 'agenda' && (
        <AgendaView slots={slots} onSlotClick={openEdit} />
      )}

      {/* Empty state for grid views */}
      {slots.length === 0 && view !== 'agenda' && (
        <div className="mt-4 text-center">
          <p className="text-ink-muted text-sm">No availability slots yet — add one to get started.</p>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <SlotModal
          slot={editingSlot}
          initDate={initDate}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
