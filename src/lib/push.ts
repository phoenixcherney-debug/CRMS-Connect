import { supabase } from './supabase'

// The VAPID *public* key is safe to ship in the client — that's what it's for.
// If it's unset, push is treated as unconfigured and the UI hides the control.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function isPushConfigured(): boolean {
  return !!VAPID_PUBLIC_KEY
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/** Base64url VAPID key → the ArrayBuffer PushManager.subscribe wants as its
 *  applicationServerKey (a BufferSource). */
function urlBase64ToBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return buffer
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Opt in on this device. Only ever called in response to a user action —
 *  requesting notification permission on load would be exactly the "by default"
 *  behavior we don't want. */
export async function enablePush(userId: string): Promise<void> {
  if (!isPushSupported()) throw new Error('This device can\'t receive push notifications.')
  if (!VAPID_PUBLIC_KEY) throw new Error('Push isn\'t configured for this site yet.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications are turned off. You can re-enable them in your browser settings.')
  }

  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY),
  })

  // A shared device may still carry the previous user's row for this endpoint,
  // and push_sub_update denies updating someone else's row — so the upsert
  // below would fail forever. Claim the endpoint first (staff-free, no-op when
  // it's already ours).
  const { error: claimError } = await supabase.rpc('claim_push_endpoint', { p_endpoint: sub.endpoint })
  if (claimError) {
    await sub.unsubscribe().catch(() => {})
    throw new Error('Couldn\'t set up notifications on this device. Please try again.')
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent.slice(0, 400),
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    // Roll back the browser subscription so state stays consistent.
    await sub.unsubscribe().catch(() => {})
    throw new Error('Couldn\'t save your push subscription. Please try again.')
  }
}

/** Opt out on this device: drop the DB row and the browser subscription. */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => {})
}
