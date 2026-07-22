import { Link } from 'react-router-dom'
import { Avatar } from './ui/Avatar'
import { affiliationLabel, FORMER_MEMBER } from '../types'
import type { PublicProfile } from '../types'

type PersonShape = Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year'>

/** Name + affiliation, the identity unit used everywhere. Affiliation is the
 *  trust signal — never render a member's name without it.
 *
 *  `person` may be null: an embedded profile join returns null once that person
 *  is disabled (RLS hides their row) even though the offer/request/message that
 *  references them is still visible. Rather than crash, we render a neutral
 *  "Former community member" placeholder. */
export function PersonLink({ person, size = 'md', sub }: {
  person: PersonShape | null | undefined
  size?: 'sm' | 'md'
  /** Extra line under the affiliation (e.g. org + title). */
  sub?: string | null
}) {
  if (!person) {
    return (
      <span className="flex items-center gap-3 min-w-0">
        <Avatar name="?" size={size === 'sm' ? 'sm' : 'md'} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-faint">{FORMER_MEMBER}</span>
          <span className="block truncate text-xs text-faint">No longer in the community</span>
        </span>
      </span>
    )
  }
  return (
    <Link to={`/people/${person.id}`} className="group flex items-center gap-3 min-w-0">
      <Avatar name={person.full_name} size={size === 'sm' ? 'sm' : 'md'} staff={person.role === 'admin'} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink group-hover:text-pine">
          {person.full_name}
        </span>
        <span className="block truncate text-xs text-faint">
          {affiliationLabel(person)}
          {sub ? ` · ${sub}` : ''}
        </span>
      </span>
    </Link>
  )
}
