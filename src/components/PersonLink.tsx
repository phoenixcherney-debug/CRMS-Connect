import { Link } from 'react-router-dom'
import { Avatar } from './ui/Avatar'
import { affiliationLabel } from '../types'
import type { PublicProfile } from '../types'

type PersonShape = Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year'>

/** Name + affiliation, the identity unit used everywhere. Affiliation is the
 *  trust signal — never render a member's name without it. */
export function PersonLink({ person, size = 'md', sub }: {
  person: PersonShape
  size?: 'sm' | 'md'
  /** Extra line under the affiliation (e.g. org + title). */
  sub?: string | null
}) {
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
