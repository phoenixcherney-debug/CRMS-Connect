import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Extra inner padding for standalone panels (default true). */
  padded?: boolean
}

export function Card({ children, padded = true, className = '', ...rest }: CardProps) {
  return (
    <div className={`bg-card border border-line rounded-xl ${padded ? 'p-5 sm:p-6' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}
