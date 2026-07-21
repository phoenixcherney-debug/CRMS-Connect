import type { ReactNode } from 'react'

export function Badge({ children, tint = 'bg-paper text-faint border border-line', className = '' }: {
  children: ReactNode
  tint?: string
  className?: string
}) {
  return (
    <span className={`eyebrow inline-flex items-center rounded-full px-2.5 py-1 whitespace-nowrap ${tint} ${className}`}>
      {children}
    </span>
  )
}
