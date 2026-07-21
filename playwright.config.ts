import { readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Minimal .env loader: e2e credentials (E2E_PASSWORD, E2E_STAFF_PASSWORD) live
// in the gitignored .env because this repo is public.
try {
  for (const line of readFileSync(new URL('.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
} catch { /* no .env — rely on real env vars */ }

/**
 * Playwright runs against either:
 *   - a deployed URL via E2E_BASE_URL (e.g. a Vercel preview), or
 *   - a local `npm run dev` server on port 5173 (the Vite default).
 *
 * In CI we set E2E_BASE_URL to the preview URL so we don't have to start
 * Supabase + Vite ourselves; locally we let Playwright manage the dev server.
 */
export default defineConfig({
  testDir: './e2e',
  // Each spec is independent; run them in parallel for speed except where the
  // spec uses test.describe.configure({ mode: 'serial' }) to share a fixture.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
