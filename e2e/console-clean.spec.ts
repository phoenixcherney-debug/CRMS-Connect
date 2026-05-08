import { test, expect } from './fixtures'

/**
 * Smoke: visiting public + commonly-broken pages must not emit any
 * console.error or pageerror. The console-error trap from ./fixtures
 * fails the test if anything is emitted. CI hardening §2.
 *
 * This spec only hits public routes (no auth required) so it's safe to
 * run against any preview deploy.
 */

test.describe.configure({ mode: 'parallel' })

const PUBLIC_PAGES: { path: string; title: RegExp }[] = [
  { path: '/login',   title: /sign in/i },
  { path: '/signup',  title: /create/i },
  { path: '/about',   title: /about/i },
  { path: '/privacy', title: /privacy/i },
]

for (const { path, title } of PUBLIC_PAGES) {
  test(`${path} renders cleanly with no console errors`, async ({ page }) => {
    await page.goto(path)
    // Wait a beat for lazy-loaded chunks + any async useEffects to finish.
    await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 10_000 })
  })
}

test('a 404 path renders the catch-all without console errors', async ({ page }) => {
  await page.goto('/this-page-does-not-exist')
  await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible({ timeout: 10_000 })
})
