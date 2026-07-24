import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/people', label: 'People' },
  { to: '/admin/offers', label: 'Offers' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit', label: 'Audit' },
]

/** Chrome for the staff pages: denser, plainer — staff are working, not browsing. */
export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="eyebrow text-clay-deep">Staff desk</p>
      <h1 className="mt-1 text-3xl">{title}</h1>
      <nav aria-label="Staff sections" className="mt-5 flex flex-wrap gap-1.5 border-b border-line pb-4">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `rounded-full px-3.5 py-1.5 text-xs font-medium ${
                isActive ? 'bg-pine text-white' : 'border border-line bg-card text-faint hover:text-ink'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  )
}
