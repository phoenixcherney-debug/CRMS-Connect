import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  children?: ReactNode
  action?: ReactNode
}

/** Empty states teach the loop — always say what this space is for. */
export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-card/60 px-6 py-12 text-center">
      <h3 className="text-lg text-ink">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-faint">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
