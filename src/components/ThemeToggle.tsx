import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

/**
 * S2.6 — extracted from Nav so /login and /signup (which don't render
 * Nav) can mount the same toggle. Pass `className` to position it.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-9 h-9 flex items-center justify-center rounded-lg
        text-ink-muted hover:text-ink hover:bg-primary-faint
        transition-colors ${className}`}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
