import { Link } from 'react-router-dom'
import { Badge } from './ui/Badge'
import { OFFER_KIND_META, LOCATION_MODE_LABEL, affiliationLabel } from '../types'
import type { Offer, PublicProfile } from '../types'
import { timeAgo } from '../lib/format'

export type OfferWithPoster = Offer & {
  poster: Pick<PublicProfile, 'id' | 'full_name' | 'role' | 'affiliation' | 'class_year' | 'organization'>
}

/** One row on the board. Poster identity is as prominent as the title —
 *  "who is opening this door" is the product. */
export function OfferCard({ offer }: { offer: OfferWithPoster }) {
  const kind = OFFER_KIND_META[offer.kind]
  const where = offer.location_text || LOCATION_MODE_LABEL[offer.location_mode]
  const facts = [where, offer.timeframe, offer.commitment].filter(Boolean)
  return (
    <Link
      to={`/board/${offer.id}`}
      className="block rounded-xl border border-line bg-card p-5 transition-colors hover:border-pine"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tint={kind.tint}>{kind.label}</Badge>
        {offer.status === 'filled' && <Badge>Filled</Badge>}
        {offer.status === 'closed' && <Badge>Closed</Badge>}
        <span className="ml-auto text-xs text-faint">{timeAgo(offer.created_at)}</span>
      </div>
      <h3 className="mt-3 text-lg leading-snug text-ink">{offer.title}</h3>
      <p className="mt-1 text-sm text-faint">
        {offer.poster.full_name} · {affiliationLabel(offer.poster)}
        {offer.poster.organization ? ` · ${offer.poster.organization}` : ''}
      </p>
      {facts.length > 0 && (
        <p className="mt-3 text-xs text-faint">{facts.join('  ·  ')}</p>
      )}
    </Link>
  )
}
