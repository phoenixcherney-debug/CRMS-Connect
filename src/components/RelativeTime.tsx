import { formatDistanceToNow, format, isAfter, subHours, parseISO } from 'date-fns'

/**
 * S2.1 — single source of truth for time labels.
 *
 * Renders a relative label ("about 2 hours ago") for timestamps within the
 * last 24 hours, and an absolute date ("May 7, 2026") otherwise. The full
 * timestamp lives in the title attribute for the curious.
 *
 * Use everywhere we surface a time. Don't reach for formatDistanceToNow
 * inline — that drifts (some sites cap at 7d, others use abbreviated copy)
 * and it makes design changes a sweep instead of a single edit.
 */
export function RelativeTime({ value, className }: {
  value: string | Date
  className?: string
}) {
  const date = typeof value === 'string' ? parseISO(value) : value
  const recent = isAfter(date, subHours(new Date(), 24))
  const text = recent
    ? formatDistanceToNow(date, { addSuffix: true })
    : format(date, 'MMM d, yyyy')
  return (
    <time
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
      className={className}
    >
      {text}
    </time>
  )
}
