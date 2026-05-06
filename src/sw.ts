/// <reference lib="webworker" />
/// <reference no-default-lib="true" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Take control of clients immediately on update
self.skipWaiting()
clientsClaim()

// Precache hashed assets (JS/CSS bundles, icons) so the app shell still works offline.
// Note: precacheAndRoute will not handle navigations — index.html is served via the
// network-first NavigationRoute below so a stale precached shell can never strand
// the user on a permanent loading screen.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA routing: network-first for navigation requests so users always get the
// latest index.html when online; fall back to the cached shell if offline.
const navigationStrategy = new NetworkFirst({
  cacheName: 'pages-cache',
  networkTimeoutSeconds: 4,
})

registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        return await navigationStrategy.handle({
          ...params,
          request: new Request('/index.html', { headers: params.request.headers }),
        })
      } catch {
        const cached = await caches.match('/index.html')
        if (cached) return cached
        return (await caches.match('/offline.html')) ??
          new Response('<h1>You\'re offline</h1>', {
            headers: { 'Content-Type': 'text/html' },
          })
      }
    },
    { denylist: [/\/[^/?]+\.[^/]+$/] }
  )
)

// Never cache Supabase auth requests — a stale auth response can hang the auth
// bootstrap forever. Always go to network.
registerRoute(
  ({ url }: { url: URL }) =>
    url.hostname.endsWith('.supabase.co') &&
    (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/realtime/')),
  async ({ request }: { request: Request }) => fetch(request)
)

// Cache other Supabase API responses with network-first (4s timeout before cache)
registerRoute(
  ({ url }: { url: URL }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({ cacheName: 'supabase-cache', networkTimeoutSeconds: 4 })
)

// Cache static assets (fonts, images) with stale-while-revalidate
registerRoute(
  ({ request }: { request: Request }) =>
    request.destination === 'font' || request.destination === 'image',
  new StaleWhileRevalidate({ cacheName: 'static-assets' })
)

// Allow the page to ask the SW to skip waiting and activate the new version.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string })?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

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
