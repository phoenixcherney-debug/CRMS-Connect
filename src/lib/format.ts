import { formatDistanceToNowStrict, format } from 'date-fns'

/** "3 days ago" — for feed-like rows where recency is the point. */
export function timeAgo(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
}

/** "Mar 4, 2026" — for records where the calendar date matters. */
export function shortDate(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy')
}

/** "Mar 4, 2:15 PM" — message timestamps. */
export function messageTime(iso: string): string {
  return format(new Date(iso), 'MMM d, h:mm a')
}
