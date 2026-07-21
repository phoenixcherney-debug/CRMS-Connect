import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

/** Header/footer chrome for logged-out pages. */
export function PublicShell({ children, cta = true }: { children: ReactNode; cta?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="font-display text-xl font-semibold text-pine">CRMS Connect</Link>
          {cta && (
            <nav className="flex items-center gap-2">
              <Link to="/login" className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-ink hover:bg-line/40">
                Sign in
              </Link>
              <Link to="/signup" className="rounded-lg bg-pine px-3.5 py-1.5 text-sm font-medium text-white hover:bg-pine-deep">
                Join
              </Link>
            </nav>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-xs text-faint">
          <span>CRMS Connect — only for the Colorado Rocky Mountain School community.</span>
          <Link to="/privacy" className="hover:text-ink">Privacy & safety</Link>
        </div>
      </footer>
    </div>
  )
}

/** Centered narrow card for auth forms. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <Link to="/" className="mb-8 block text-center font-display text-2xl font-semibold text-pine">
          CRMS Connect
        </Link>
        <div className="rounded-xl border border-line bg-card p-6 sm:p-8">
          <h1 className="text-2xl">{title}</h1>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
