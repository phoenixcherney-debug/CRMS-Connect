// Push handlers, imported into the generated Workbox service worker
// (vite.config.ts → workbox.importScripts). Kept tiny and separate from the
// caching worker so caching behavior is unaffected.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_e) {
    data = {}
  }
  const title = data.title || 'CRMS Connect'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.link || 'crms-connect',
      data: { link: data.link || '/notifications' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/notifications'
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          if ('navigate' in client) {
            try {
              await client.navigate(link)
            } catch (_e) {
              /* cross-origin or detached — fall through to focus */
            }
          }
          return client.focus()
        }
      }
      return self.clients.openWindow(link)
    })(),
  )
})
