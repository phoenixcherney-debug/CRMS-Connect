import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusSquare, BookOpen, Heart, CalendarClock, X, ArrowRight } from 'lucide-react'

const TOUR_KEY = 'crms.onboarding.show_em_tour'

/**
 * P2-13 — one-screen welcome modal shown to fresh employer/mentor accounts
 * the first time they land on /explore. Reads + clears its trigger key
 * (`crms.onboarding.show_em_tour`) on mount so it shows exactly once.
 *
 * Hidden behind a localStorage flag that Onboarding.tsx sets right before
 * the post-completion redirect — that's the only entry point. Manual
 * dismissals also clear the flag (skip + cards both).
 */
export default function EmployerTourModal() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(TOUR_KEY) === '1' }
    catch { return false }
  })

  if (!open) return null

  function close() {
    try { localStorage.removeItem(TOUR_KEY) } catch { /* ignore */ }
    setOpen(false)
  }

  const cards: { icon: typeof PlusSquare; title: string; body: string; to: string }[] = [
    {
      icon: PlusSquare,
      title: 'Post an opportunity',
      body: 'Share an internship, mentorship, or project. Students apply directly.',
      to: '/opportunities/new',
    },
    {
      icon: BookOpen,
      title: 'See who\'s looking',
      body: 'Read student "looking for" posts to find inbound interest in your industry.',
      to: '/student-posts',
    },
    {
      icon: Heart,
      title: 'Turn on mentor mode',
      body: 'Make yourself visible in the mentor directory and accept meeting requests.',
      to: '/profile/edit',
    },
    {
      icon: CalendarClock,
      title: 'Set availability (optional)',
      body: 'Pick the slots when you\'re free for student meetings — or leave it open.',
      to: '/availability',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 overflow-y-auto">
      <div
        className="bg-surface rounded-2xl border border-border max-w-2xl w-full p-6 sm:p-8"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-xl font-bold text-ink" style={{ fontFamily: 'var(--font-serif)' }}>
              Welcome to CRMS Connect
            </h2>
            <p className="text-sm text-ink-secondary mt-1">
              Four quick ways to get started — pick one or skip and explore.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-ink-muted hover:text-ink w-7 h-7 flex items-center justify-center rounded-lg hover:bg-primary-faint"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          {cards.map(({ icon: Icon, title, body, to }) => (
            <Link
              key={title}
              to={to}
              onClick={close}
              className="group p-4 rounded-xl border border-border bg-surface hover:border-primary hover:bg-primary-faint transition-colors flex flex-col gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center text-primary">
                <Icon size={17} />
              </div>
              <p className="font-semibold text-ink text-sm">{title}</p>
              <p className="text-xs text-ink-secondary leading-relaxed flex-1">{body}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary mt-1">
                Open <ArrowRight size={11} />
              </span>
            </Link>
          ))}
        </div>

        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={close}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Skip the tour
          </button>
        </div>
      </div>
    </div>
  )
}
