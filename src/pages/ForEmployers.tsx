import { Link } from 'react-router-dom'
import { ArrowRight, Briefcase, Users, ShieldCheck, FileText, Send } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'
import CommunityStats from '../components/CommunityStats'

/**
 * P2-20 — public pitch page for prospective employers / posting partners.
 * Linked from the landing-page hero + footer alongside /for-mentors.
 */
export default function ForEmployers() {
  return (
    <div className="min-h-screen flex flex-col relative" style={{ backgroundColor: 'var(--color-background)' }}>
      <ThemeToggle className="absolute top-4 right-4 z-10" />

      <section
        className="px-6 sm:px-10 py-16 sm:py-24 text-white relative overflow-hidden"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 80% 20%, rgba(74,124,47,0.7) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 20% 80%, rgba(45,80,22,0.5) 0%, transparent 50%),
            linear-gradient(155deg, #2D5016 0%, #3A6B1E 35%, #4A7C2F 65%, #3A6B1E 100%)
          `,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <p className="text-white/60 text-xs font-bold uppercase tracking-[0.2em] mb-3">
            For Employers
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
            Post once. Reach the whole school.
          </h1>
          <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl">
            CRMS Connect is the school's private network for opportunities —
            internships, summer jobs, paid projects, volunteer roles. Verified
            student accounts only, vetted by the school. Free to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white text-primary-dark font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              Sign up to post <ArrowRight size={15} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 sm:px-10 pt-8 max-w-3xl mx-auto w-full">
        <CommunityStats />
      </section>

      <section className="px-6 sm:px-10 py-12 sm:py-16 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-ink mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
          How posting works
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Briefcase,
              title: 'Post in five minutes',
              body: 'Title, description, dates, optional compensation. Preview before publish to see exactly what students will see.',
            },
            {
              icon: Users,
              title: 'Verified students only',
              body: 'Every applicant is a CRMS student (grades 9 through gap year), authenticated against their @crms.org email.',
            },
            {
              icon: FileText,
              title: 'Applications come to you',
              body: 'Each applicant\'s cover note, weekly availability, grade level (if shared), and any portfolio link. Filter and reply directly.',
            },
            {
              icon: ShieldCheck,
              title: 'Privacy by default',
              body: 'Your contact email is hidden from applicants until you accept them. Students never see other applicants\' details.',
            },
            {
              icon: Send,
              title: 'Direct messaging',
              body: 'Once you accept, a thread opens automatically with a system note. Coordinate next steps without leaving the platform.',
            },
            {
              icon: Briefcase,
              title: 'No fees',
              body: 'Free for the school community. We aren\'t a job board — we\'re a school program for connecting students with the people doing the work.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="bg-surface rounded-xl border border-border p-5"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center text-primary mb-3">
                <Icon size={17} />
              </div>
              <p className="font-semibold text-ink mb-1">{title}</p>
              <p className="text-sm text-ink-secondary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 sm:px-10 py-12 sm:py-16 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-ink mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
          Ready to post?
        </h2>
        <p className="text-sm text-ink-secondary mb-5">
          Sign up with a personal email; the school will set up your access. Then post your first opportunity from the Explore page.
        </p>
        <Link
          to="/signup"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg btn-gold text-sm"
        >
          Sign up to post <ArrowRight size={14} />
        </Link>
      </section>

      <footer className="px-6 sm:px-10 py-8 mt-auto border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-muted">
        <p>© Colorado Rocky Mountain School</p>
        <div className="flex gap-4">
          <Link to="/" className="hover:text-ink">Home</Link>
          <Link to="/about" className="hover:text-ink">About</Link>
          <Link to="/privacy" className="hover:text-ink">Privacy</Link>
          <Link to="/contact" className="hover:text-ink">Contact</Link>
        </div>
      </footer>
    </div>
  )
}
