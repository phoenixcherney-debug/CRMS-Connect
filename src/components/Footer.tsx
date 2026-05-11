import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Task 27 — single global footer. Renders one of two link sets:
 *   • logged-out: For Mentors / For Employers / Why CRMS Connect? /
 *                 Privacy / Contact
 *   • logged-in:  About / Privacy / Contact
 *
 * The auth split keeps the public-facing marketing links off pages
 * a signed-in user has already moved past. Both variants share the
 * copyright line so visual rhythm doesn't break across the auth
 * boundary. Public marketing pages (Landing, ForMentors, ForEmployers)
 * also mount this directly instead of carrying their own local
 * <footer> markup.
 */
export default function Footer() {
  const { user } = useAuth()
  const year = new Date().getFullYear()
  const links = user
    ? [
        { to: '/about',   label: 'About' },
        { to: '/privacy', label: 'Privacy' },
        { to: '/contact', label: 'Contact' },
      ]
    : [
        { to: '/for-mentors',   label: 'For Mentors' },
        { to: '/for-employers', label: 'For Employers' },
        { to: '/about',         label: 'Why CRMS Connect?' },
        { to: '/privacy',       label: 'Privacy' },
        { to: '/contact',       label: 'Contact' },
      ]

  return (
    <footer
      className="mt-12 border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
        <p>© {year} Colorado Rocky Mountain School. CRMS Connect.</p>
        <nav className="flex items-center gap-5 flex-wrap justify-center">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-ink transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
