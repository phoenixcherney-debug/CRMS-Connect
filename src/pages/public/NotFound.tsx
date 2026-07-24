import { Link } from 'react-router-dom'
import { PublicShell } from './PublicShell'

export function NotFound() {
  return (
    <PublicShell cta={false}>
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="eyebrow text-clay-deep">404</p>
        <h1 className="mt-3 text-3xl">This door doesn't exist</h1>
        <p className="mt-3 text-sm text-faint">
          The page you're after may have been filled, closed, or never opened.
        </p>
        <Link to="/home" className="mt-6 inline-block rounded-lg bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-deep">
          Back to the board
        </Link>
      </div>
    </PublicShell>
  )
}
