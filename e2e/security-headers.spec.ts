import { test, expect } from '@playwright/test'

/**
 * Task 4 — CSP + security headers. These live in vercel.json and only
 * apply to the deployed build (not `vite dev`). The spec is opt-in via
 * E2E_BASE_URL; locally we just skip.
 */

test.describe('security headers', () => {
  test.skip(!process.env.E2E_BASE_URL, 'requires a deployed preview URL')

  test('every key header is present on / and /explore', async ({ request }) => {
    for (const path of ['/', '/explore']) {
      const res = await request.get(path)
      expect(res.status(), `${path} 200`).toBe(200)
      const headers = res.headers()
      expect(headers['content-security-policy'], `${path} CSP`).toBeTruthy()
      expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
      expect(headers['x-content-type-options']).toBe('nosniff')
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
      expect(headers['permissions-policy']).toContain('camera=()')
      expect(headers['strict-transport-security']).toMatch(/max-age=\d+/)
    }
  })
})
