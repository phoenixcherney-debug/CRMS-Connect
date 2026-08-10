import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { disablePush } from './push'

/** How long sign-out waits for push teardown before continuing anyway.
 *  `navigator.serviceWorker.ready` never settles when no worker is registered
 *  (dev, or a browser that blocked it), and sign-out must never hang on it. */
const PUSH_TEARDOWN_TIMEOUT_MS = 2_000

/** Sign out and return to the public landing page. Shared by the header menu,
 *  the waiting/disabled screens, and the account-load error gate so the
 *  post-logout destination stays consistent (review nit A-04). */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  return useCallback(async () => {
    // Tear push down *before* dropping the session — disablePush needs the
    // session to delete its row, and both that row and the browser's own
    // PushSubscription otherwise outlive logout. On a shared device that means
    // the next person keeps receiving the previous user's notifications, whose
    // bodies carry left(message.body, 140) of their thread (review major).
    // Failures are swallowed and the wait is capped: logout must always finish.
    await Promise.race([
      disablePush().catch(() => {}),
      new Promise<void>((resolve) => setTimeout(resolve, PUSH_TEARDOWN_TIMEOUT_MS)),
    ])
    await signOut()
    navigate('/')
  }, [signOut, navigate])
}
