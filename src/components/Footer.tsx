import { Link } from 'react-router-dom'

/**
 * Stub footer with the bare-minimum legal links a school-affiliated product
 * collecting student data should expose. The audit called these "table stakes".
 * Each /about, /privacy is a thin static page; /contact links the CRMS office
 * directly because the school is the data controller, not us.
 */
export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer
      className="mt-12 border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
        <p>© {year} Colorado Rocky Mountain School. CRMS Connect.</p>
        <nav className="flex items-center gap-5">
          <Link to="/about"   className="hover:text-ink transition-colors">About</Link>
          <Link to="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
          <Link to="/contact" className="hover:text-ink transition-colors">Contact</Link>
        </nav>
      </div>
    </footer>
  )
}
