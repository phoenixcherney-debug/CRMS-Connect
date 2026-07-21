import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  currentSubscription,
  disablePush,
  enablePush,
  isPushConfigured,
  isPushSupported,
  pushPermission,
} from '../lib/push'

type PushState = 'loading' | 'unsupported' | 'unconfigured' | 'blocked' | 'off' | 'on'

/** Drives the opt-in push toggle. Reads the current device state on mount and
 *  exposes enable/disable actions; it never subscribes on its own. */
export function usePush() {
  const { user } = useAuth()
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isPushSupported()) return setState('unsupported')
    if (!isPushConfigured()) return setState('unconfigured')
    if (pushPermission() === 'denied') return setState('blocked')
    const sub = await currentSubscription()
    setState(sub ? 'on' : 'off')
  }, [])

  useEffect(() => {
    // Deferred so this isn't a synchronous setState inside an effect.
    const t = setTimeout(refresh, 0)
    return () => clearTimeout(t)
  }, [refresh])

  const enable = useCallback(async () => {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await enablePush(user.id)
      setState('on')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [user, refresh])

  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await disablePush()
      setState('off')
    } catch {
      setError('Couldn\'t turn push off. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, busy, error, enable, disable }
}
