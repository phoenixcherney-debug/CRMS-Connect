import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, MapPin, Building2, Clock, ChevronLeft, Briefcase } from 'lucide-react'
import { format, isPast, parseISO, differenceInDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { Job } from '../types'
import { JOB_TYPE_LABELS } from '../types'
import Spinner from '../components/Spinner'

interface EventItem {
  id: string
  title: string
  subtitle: string
  location: string
  date: string
  type: 'deadline'
  jobId: string
  jobType: string
}

export default function Events() {
  const [upcoming, setUpcoming] = useState<EventItem[]>([])
  const [past, setPast] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .order('deadline', { ascending: true })

      const events: EventItem[] = ((jobs as Job[]) ?? []).map((job) => ({
        id: job.id,
        title: `${job.title} — Application Deadline`,
        subtitle: job.company,
        location: job.location,
        date: job.deadline,
        type: 'deadline',
        jobId: job.id,
        jobType: JOB_TYPE_LABELS[job.job_type],
      }))

      setUpcoming(events.filter((e) => !isPast(parseISO(e.date))))
      setPast(events.filter((e) => isPast(parseISO(e.date))).reverse().slice(0, 10))
      setLoading(false)
    }
    load()
  }, [])

  function urgencyColor(dateStr: string) {
    const days = differenceInDays(parseISO(dateStr), new Date())
    if (days <= 3) return 'border-l-red-400 bg-red-50/50'
    if (days <= 7) return 'border-l-amber-400 bg-amber-50/50'
    return 'border-l-primary bg-surface'
  }

  function urgencyLabel(dateStr: string) {
    const days = differenceInDays(parseISO(dateStr), new Date())
    if (days === 0) return 'Today!'
    if (days === 1) return 'Tomorrow'
    if (days <= 3) return `${days} days left`
    if (days <= 7) return `${days} days left`
    return null
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link to="/explore" className="inline-flex items-center gap-1 text-sm text-ink-secondary hover:text-ink mb-3">
          <ChevronLeft size={16} /> Explore
        </Link>
        <h1 className="text-2xl font-bold text-ink">Events</h1>
        <p className="text-ink-secondary text-sm mt-0.5">Upcoming deadlines and dates to remember</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="space-y-8">
          {/* Upcoming */}
          <section>
            <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
              <CalendarDays size={14} />
              Upcoming
            </h2>
            {upcoming.length === 0 ? (
              <div className="text-center py-12 bg-surface rounded-2xl border border-border">
                <CalendarDays size={32} className="text-ink-muted mx-auto mb-2" />
                <p className="text-sm text-ink-muted">No upcoming deadlines.</p>
                <Link to="/jobs" className="mt-3 inline-block text-sm text-primary hover:text-primary-light font-medium">
                  Browse opportunities
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {upcoming.map((event) => {
                  const urgent = urgencyLabel(event.date)
                  return (
                    <Link
                      key={event.id}
                      to={`/jobs/${event.jobId}`}
                      className={`flex gap-4 rounded-xl border border-border border-l-4 p-4 hover:shadow-md transition-shadow ${urgencyColor(event.date)}`}
                    >
                      <div className="text-center shrink-0 w-12">
                        <p className="text-2xl font-bold text-ink leading-none">
                          {format(parseISO(event.date), 'd')}
                        </p>
                        <p className="text-xs text-ink-muted font-medium uppercase">
                          {format(parseISO(event.date), 'MMM')}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-ink leading-snug">{event.title}</h3>
                          {urgent && (
                            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-error text-white">
                              {urgent}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-ink-muted">
                          <span className="flex items-center gap-1">
                            <Building2 size={11} /> {event.subtitle}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={11} /> {event.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Briefcase size={11} /> {event.jobType}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* Past deadlines */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-medium text-ink-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock size={14} />
                Recently Passed
              </h2>
              <div className="space-y-2 opacity-60">
                {past.map((event) => (
                  <Link
                    key={event.id}
                    to={`/jobs/${event.jobId}`}
                    className="flex gap-4 rounded-xl border border-border bg-surface p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="text-center shrink-0 w-12">
                      <p className="text-2xl font-bold text-ink-muted leading-none">
                        {format(parseISO(event.date), 'd')}
                      </p>
                      <p className="text-xs text-ink-muted font-medium uppercase">
                        {format(parseISO(event.date), 'MMM')}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-ink-muted leading-snug line-clamp-1">
                        {event.title}
                      </h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-ink-muted">
                        <span className="flex items-center gap-1">
                          <Building2 size={11} /> {event.subtitle}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {event.location}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
