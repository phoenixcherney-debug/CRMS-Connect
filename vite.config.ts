import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // updateViaCache: 'none' tells the browser to bypass the HTTP cache when
      // checking for an updated service worker — guards against the "stale
      // shell + new JS bundle" combo that hung the cold-start loader.
      injectRegister: 'auto',
      injectManifest: {
        // Don't precache the HTML shell — we serve it network-first from sw.ts.
        // Precaching it together with NavigationRoute(NetworkFirst) was the
        // setup that hung when the cached HTML referenced a JS chunk hash
        // the user no longer had.
        globPatterns: ['**/*.{js,css,svg,png,ico,webp,woff2}'],
      },
      workbox: {
        // No-op for injectManifest mode but kept for documentation.
      },
      // Precache these assets in the app shell
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png', 'pwa-512x512-maskable.png', 'apple-touch-icon.png', 'offline.html'],
      manifest: {
        name: 'CRMS Connect',
        short_name: 'CRMS',
        description: 'Colorado Rocky Mountain School career connections platform',
        theme_color: '#257200',
        background_color: '#257200',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
