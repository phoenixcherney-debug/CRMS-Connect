import { test as base, expect } from '@playwright/test'

/**
 * Console-error trap (CI hardening §2). Every test instantiated from this
 * fixture fails if the page emits a console.error or an unhandled
 * pageerror. This is the safety net that would have caught B1 (the React
 * #310 crash on /profile) before it shipped.
 *
 * Usage:
 *   import { test, expect } from './fixtures'
 *
 * Allow-list: pass `consoleErrorAllow` from a test or describe block to
 * tolerate specific known-noisy messages (e.g. third-party warnings).
 */

interface Fixtures {
  consoleErrorAllow: RegExp[]
}

export const test = base.extend<Fixtures>({
  consoleErrorAllow: [[], { option: true }],

  page: async ({ page, consoleErrorAllow }, use) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (consoleErrorAllow.some((re) => re.test(text))) return
      errors.push(`[console.error] ${text}`)
    })

    page.on('pageerror', (err) => {
      const text = err.message
      if (consoleErrorAllow.some((re) => re.test(text))) return
      errors.push(`[pageerror] ${text}`)
    })

    await use(page)

    if (errors.length > 0) {
      throw new Error(`Page emitted ${errors.length} unallowed console error(s):\n${errors.join('\n')}`)
    }
  },
})

export { expect }
