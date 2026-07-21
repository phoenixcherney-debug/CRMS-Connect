import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-pine text-white hover:bg-pine-deep disabled:hover:bg-pine',
  accent: 'bg-clay text-white hover:bg-clay-deep disabled:hover:bg-clay',
  secondary: 'bg-card text-ink border border-line-strong hover:border-pine hover:text-pine',
  ghost: 'text-faint hover:text-ink hover:bg-line/40',
  danger: 'bg-card text-danger border border-line-strong hover:border-danger',
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-lg gap-2',
  lg: 'px-5 py-2.5 text-base rounded-xl gap-2',
}

export function Button({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" light={variant === 'primary' || variant === 'accent'} />}
      {children}
    </button>
  )
}
