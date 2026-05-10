import { Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Clock, MessageSquare, Heart, Calendar } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle'

/**
 * P2-20 — public pitch page for prospective mentors. Linked from the
 * landing page hero + footer so alumni and local employers can read
 * about the program before signing up.
 */
export default function ForMentors() {
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
            For Mentors & Alumni
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
            Help a CRMS student figure out what's next.
          </h1>
          <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl">
            CRMS Connect lets alumni and local professionals advise current
            students on internships, college, careers — whatever they're
            puzzling over. Set your own availability, stay private until you
            decide otherwise, and only meet the students you want to.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-white text-primary-dark font-semibold text-sm hover:bg-white/90 transition-colors"
            >
              Sign up as a mentor <ArrowRight size={15} />
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

      <section className="px-6 sm:px-10 py-12 sm:py-16 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-ink mb-6" style={{ fontFamily: 'var(--font-serif)' }}>
          What it looks like
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Heart,
              title: 'Mentor mode is opt-in',
              body: 'Toggle "open to mentorship" off any time and you disappear from the directory. No quotas, no obligations.',
            },
            {
              icon: Calendar,
              title: 'You set the times',
              body: 'Pick the slots you want to be reachable, in 30-minute blocks across the week. Or leave it open and respond when it\'s convenient.',
            },
            {
              icon: ShieldCheck,
              title: 'Privacy by default',
              body: 'Students see your name, role, and bio. Your email stays private until you accept a meeting request or someone\'s application to a role you posted.',
            },
            {
              icon: MessageSquare,
              title: 'Direct messaging',
              body: 'Same-role DMs are blocked, so no spam from peers. Conversations are inside the platform — no inbox flood.',
            },
            {
              icon: Clock,
              title: 'Light commitment',
              body: 'Most mentor relationships are a single 20–30 minute call. Some students follow up, most thank you and move on.',
            },
            {
              icon: Heart,
              title: 'Verified students only',
              body: 'Every student account uses a @crms.org email and is grade-9 through gap-year. No outsiders.',
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

      <section className="px-6 sm:px-10 py-12 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-ink mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
          What students are looking for
        </h2>
        <p className="text-sm text-ink-secondary mb-5">
          A few representative student "looking for" posts (redacted; updated periodically):
        </p>
        <div className="space-y-3">
          {[
            { grade: 'Junior', interests: 'Engineering · Sustainability', body: 'Hoping to talk to anyone in renewable energy, especially structural / civil. Interested in summer shadow days.' },
            { grade: 'Sophomore', interests: 'Healthcare', body: 'Curious about what nursing school looks like and whether DOs are different from MDs in practice.' },
            { grade: 'Senior', interests: 'Marketing · Design', body: 'Building a portfolio for college apps. Would love a brief call about what working in branding actually looks like.' },
          ].map((p, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border p-4">
              <p className="text-xs text-ink-muted">{p.grade} · {p.interests}</p>
              <p className="text-sm text-ink mt-1.5 italic">"{p.body}"</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 sm:px-10 py-12 sm:py-16 text-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-ink mb-3" style={{ fontFamily: 'var(--font-serif)' }}>
          Ready?
        </h2>
        <p className="text-sm text-ink-secondary mb-5">
          Signup takes two minutes. Onboarding takes another two. After that you'll appear in the mentor directory and students can request meetings.
        </p>
        <Link
          to="/signup"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg btn-gold text-sm"
        >
          Sign up as a mentor <ArrowRight size={14} />
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
