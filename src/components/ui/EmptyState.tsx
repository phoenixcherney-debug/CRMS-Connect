import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  children?: ReactNode
  action?: ReactNode
  /** Heading level. Defaults to h2: an empty state usually sits directly under
   *  the page h1, and hardcoding h3 skipped a level. Pass 'h3' only where a
   *  real h2 already precedes it. */
  as?: 'h2' | 'h3'
}

/** Empty states teach the loop — always say what this space is for. */
export function EmptyState({ title, children, action, as: Heading = 'h2' }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-card/60 px-6 py-12 text-center">
      <Heading className="text-lg text-ink">{title}</Heading>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-faint">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
