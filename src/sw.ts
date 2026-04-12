/// <reference lib="webworker" />
/// <reference no-default-lib="true" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Take control of clients immediately on update
self.skipWaiting()
clientsClaim()

// Precache the full app shell (URLs injected by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST)

// SPA routing: serve the precached index.html for all navigation requests.
// Falls back to offline.html if neither the network nor the cache can respond.
const navigationHandler = createHandlerBoundToURL('/index.html')
registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        return await navigationHandler(params)
      } catch {
        return (await caches.match('/offline.html')) ??
          new Response('<h1>You\'re offline</h1>', {
            headers: { 'Content-Type': 'text/html' },
          })
      }
    },
    { denylist: [/\/[^/?]+\.[^/]+$/] }
  )
)

// Cache Supabase API responses with network-first (10s timeout before cache)
registerRoute(
  ({ url }: { url: URL }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({ cacheName: 'supabase-cache', networkTimeoutSeconds: 10 })
)

// Cache static assets (fonts, images) with stale-while-revalidate
registerRoute(
  ({ request }: { request: Request }) =>
    request.destination === 'font' || request.destination === 'image',
  new StaleWhileRevalidate({ cacheName: 'static-assets' })
)

// ─── Push Notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  const { title, body, url } = event.data.json() as {
    title: string
    body: string
    url?: string
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: url ?? '/' },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data as { url?: string })?.url ?? '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('navigate' in client) {
            void (client as WindowClient).navigate(url)
            return client.focus()
          }
        }
        return self.clients.openWindow(url)
      })
  )
})
