import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // v2 uses the plain generateSW strategy: no push, no custom sw.ts. With
    // autoUpdate the generated worker skips waiting + claims clients, so a
    // deploy can't strand users on a stale shell pointing at gone chunks
    // (the failure mode that motivated v1's hand-rolled worker).
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'pwa-512x512-maskable.png', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        // Pull the push/notificationclick handlers into the generated worker
        // (see public/push-sw.js) without hand-rolling the caching worker.
        importScripts: ['/push-sw.js'],
      },
      manifest: {
        name: 'CRMS Connect',
        short_name: 'CRMS',
        description: 'Opportunities shared only within the Colorado Rocky Mountain School community.',
        theme_color: '#1e4d3b',
        background_color: '#f7f4ed',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
