import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, Users, MessageSquare } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

const CRMS_LOGO = 'https://www.crms.org/wp-content/uploads/2020/09/Vector-Smart-Object-copy.png'

/**
 * Public landing page at `/`. Signed-out home; signed-in users are routed
 * to /explore by HomeRouter in App.tsx before they see this.
 *
 * Kept intentionally light — three feature blurbs and two CTAs. The /about
 * page covers full marketing copy.
 */
export default function Landing() {
  const [logoError, setLogoError] = useState(false)
  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: 'var(--color-background)' }}>
      <ThemeToggle className="absolute top-4 right-4" />

      {/* Hero */}
      <section
        className="px-6 sm:px-10 py-16 sm:py-24 flex flex-col items-center text-center text-white relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 80% 20%, rgba(74,124,47,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 20% 80%, rgba(45,80,22,0.5) 0%, transparent 50%),
            linear-gradient(155deg, #2D5016 0%, #3A6B1E 35%, #4A7C2F 65%, #3A6B1E 100%)
          `,
        }}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
          {logoError ? (
            <span className="text-2xl font-black text-white">C</span>
          ) : (
            <img src={CRMS_LOGO} alt="CRMS" className="h-10 w-auto brightness-0 invert" onError={() => setLogoError(true)} />
          )}
        </div>
        <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mb-3">Colorado Rocky Mountain School</p>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 max-w-2xl" style={{ fontFamily: 'var(--font-serif)' }}>
          The CRMS Connect community
        </h1>
        <p className="text-white/80 text-base sm:text-lg max-w-xl leading-relaxed mb-8">
          A private network for CRMS students, alumni, and partners — discover
          opportunities, connect with mentors, and stay close to school.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white text-primary-dark font-semibold text-sm hover:bg-white/90 transition-colors"
          >
            Create an account <ArrowRight size={15} />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
          >
            Sign in
          </Link>
        </div>
        {/* P2-20 — secondary CTA targeting alumni / local employers, who
            otherwise have no signal that the platform is for them too. */}
        <p className="text-white/70 text-sm mt-6">
          Are you a CRMS alum or local employer?{' '}
          <Link to="/for-mentors" className="text-white font-semibold hover:underline">Become a mentor →</Link>
          <span className="text-white/40"> · </span>
          <Link to="/for-employers" className="text-white font-semibold hover:underline">Post opportunities →</Link>
        </p>
      </section>

      {/* Feature blurbs */}
      <section className="px-6 sm:px-10 py-12 sm:py-16 grid gap-6 sm:grid-cols-3 max-w-5xl mx-auto w-full">
        {[
          {
            icon: Briefcase,
            title: 'Real opportunities',
            body: 'Internships, mentorships, and volunteer roles posted by CRMS alumni and community partners.',
          },
          {
            icon: Users,
            title: 'Mentors & alumni',
            body: 'Connect with people who have walked the path — across industries, geographies, and decades.',
          },
          {
            icon: MessageSquare,
            title: 'Direct messaging',
            body: 'Reach out directly to students, mentors, and alumni — keep conversations private to the CRMS community.',
          },
        ].map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="bg-surface rounded-xl border border-border p-5"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="w-10 h-10 rounded-lg bg-primary-muted flex items-center justify-center text-primary mb-3">
              <Icon size={18} />
            </div>
            <p className="font-semibold text-ink mb-1">{title}</p>
            <p className="text-sm text-ink-secondary leading-relaxed">{body}</p>
          </div>
        ))}
      </section>

      {/* Footer links */}
      <footer className="px-6 sm:px-10 py-8 mt-auto border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
        <p>© Colorado Rocky Mountain School</p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link to="/for-mentors" className="hover:text-ink">For Mentors</Link>
          <Link to="/for-employers" className="hover:text-ink">For Employers</Link>
          <Link to="/about" className="hover:text-ink">Why CRMS Connect?</Link>
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
          <Link to="/contact" className="hover:text-ink">Contact</Link>
        </div>
      </footer>
    </div>
  )
}
