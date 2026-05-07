import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  ctaLabel?: string
  ctaTo?: string
  ctaOnClick?: () => void
  /** Visual size — most pages use 'lg' (default), inline lists use 'sm'. */
  size?: 'sm' | 'lg'
}

/**
 * Single empty-state component used across Notifications, Messages, Events,
 * Feed, My Posts, etc. Replaces the four ad-hoc variants the audit called out
 * (different icon size, copy tone, CTA placement).
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaTo,
  ctaOnClick,
  size = 'lg',
}: EmptyStateProps) {
  const isLarge = size === 'lg'
  const padding = isLarge ? 'py-16 px-6' : 'py-10 px-4'
  const iconSize = isLarge ? 32 : 24

  return (
    <div
      className={`text-center ${padding} bg-surface rounded-2xl border border-border`}
    >
      {Icon && (
        <div className="flex justify-center mb-3">
          <Icon size={iconSize} className="text-ink-muted" aria-hidden="true" />
        </div>
      )}
      <p className={`font-medium text-ink ${isLarge ? 'text-base' : 'text-sm'}`}>{title}</p>
      {description && (
        <p className={`text-ink-muted mt-1 ${isLarge ? 'text-sm' : 'text-xs'}`}>{description}</p>
      )}
      {ctaLabel && (ctaTo || ctaOnClick) && (
        <div className="mt-4">
          {ctaTo ? (
            <Link
              to={ctaTo}
              className="inline-flex items-center text-sm font-semibold text-primary hover:text-primary-light"
            >
              {ctaLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={ctaOnClick}
              className="inline-flex items-center text-sm font-semibold text-primary hover:text-primary-light"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
