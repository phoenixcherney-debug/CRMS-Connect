import { initialsOf } from '../../lib/initials'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
}

export function Avatar({ name, size = 'md', staff = false }: { name: string; size?: keyof typeof SIZES; staff?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${staff ? 'bg-pine text-white' : 'bg-meadow text-pine'} ${SIZES[size]}`}
    >
      {initialsOf(name)}
    </span>
  )
}
