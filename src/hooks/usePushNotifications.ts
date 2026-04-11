import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type PushPermission = 'loading' | 'unsupported' | 'default' | 'granted' | 'denied'

export function usePushNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<PushPermission>('loading')
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) {
      setPermission('unsupported')
      return
    }
    const perm = Notification.permission
    if (perm === 'denied') {
      setPermission('denied')
      return
    }
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub)
        setPermission(perm === 'granted' ? 'granted' : 'default')
      })
    })
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!user || !VAPID_PUBLIC_KEY) return false
    try {
      const reg = await navigator.serviceWorker.ready
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setPermission('denied')
        return false
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })
      const json = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth_key: json.keys!.auth,
        },
        { onConflict: 'user_id,endpoint' }
      )
      if (error) throw error
      setIsSubscribed(true)
      setPermission('granted')
      return true
    } catch (err) {
      console.error('Push subscribe error:', err)
      return false
    }
  }, [user])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint)
      }
      setIsSubscribed(false)
      setPermission('default')
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    }
  }, [user])

  return { permission, isSubscribed, subscribe, unsubscribe }
}
