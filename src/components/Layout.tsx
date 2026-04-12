import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import Nav from './Nav'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAuth } from '../contexts/AuthContext'

const BANNER_DISMISSED_KEY = 'push_banner_dismissed'

interface LayoutProps {
  children: React.ReactNode
}

function PushBanner() {
  const { user } = useAuth()
  const { permission, isSubscribed, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(BANNER_DISMISSED_KEY) === '1'
  )
  const [subscribing, setSubscribing] = useState(false)

  if (!user || dismissed || isSubscribed || permission !== 'default') return null

  async function handleEnable() {
    setSubscribing(true)
    await subscribe()
    setSubscribing(false)
    setDismissed(true)
    localStorage.setItem(BANNER_DISMISSED_KEY, '1')
  }

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem(BANNER_DISMISSED_KEY, '1')
  }

  return (
    <div className="px-4 py-2.5 flex items-center gap-3" style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-primary-dark)' }}>
      <Bell size={15} className="shrink-0" />
      <p className="flex-1 text-sm font-bold">
        Enable push notifications for messages and application updates.
      </p>
      <button
        onClick={handleEnable}
        disabled={subscribing}
        className="shrink-0 px-3 py-1 rounded-md bg-black/10 hover:bg-black/20 text-xs font-semibold transition-colors disabled:opacity-60"
      >
        {subscribing ? 'Enabling…' : 'Enable'}
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-60 hover:opacity-100 transition-colors"
        aria-label="Dismiss"
      >
        <X size={15} />
      </button>
    </div>
  )
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <PushBanner />
      <Nav />
      <main
        className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
    </div>
  )
}
