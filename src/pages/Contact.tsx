import { Mail, Phone, MapPin } from 'lucide-react'

/**
 * P0-2 — the footer links to /contact on every page; this used to 404
 * and the 404 page itself had the same link, so users were trapped.
 *
 * Kept intentionally simple: registrar contact info + the link to
 * /privacy. If we later want a real contact form it slots into the
 * same component.
 */
export default function Contact() {
  return (
    <div className="max-w-2xl mx-auto py-6 text-ink-secondary leading-relaxed space-y-4">
      <h1 className="text-2xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
        Contact
      </h1>
      <p>
        Questions, account problems, or anything else CRMS Connect-related — the
        registrar's office is the right first stop.
      </p>

      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <Mail size={14} className="text-ink-muted" />
          <a className="text-primary hover:text-primary-light underline" href="mailto:registrar@crms.org?subject=CRMS%20Connect">
            registrar@crms.org
          </a>
        </li>
        <li className="flex items-center gap-2">
          <Phone size={14} className="text-ink-muted" />
          <a className="text-primary hover:text-primary-light underline" href="tel:+19709634215">
            (970) 963-2562
          </a>
        </li>
        <li className="flex items-center gap-2">
          <MapPin size={14} className="text-ink-muted" />
          <span>500 Holden Way, Carbondale, CO 81623</span>
        </li>
      </ul>

      <p className="text-xs text-ink-muted pt-4">
        For data and privacy questions, see the{' '}
        <a className="text-primary hover:text-primary-light underline" href="/privacy">privacy policy</a>.
      </p>
    </div>
  )
}
