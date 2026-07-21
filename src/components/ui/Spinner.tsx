interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  light?: boolean
  /** Center in a tall block — the loading state for whole pages. */
  page?: boolean
}

const SIZES = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-9 w-9 border-[3px]' }

export function Spinner({ size = 'md', light = false, page = false }: SpinnerProps) {
  const el = (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-solid ${light ? 'border-white/40 border-t-white' : 'border-line-strong border-t-pine'} ${SIZES[size]}`}
    />
  )
  if (!page) return el
  return <div className="flex justify-center py-24">{el}</div>
}
