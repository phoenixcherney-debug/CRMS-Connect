import { test as setup } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { ACCOUNTS, login } from './helpers'

// One login per role, saved as storage state the role projects reuse. This is
// the only place credentials are exercised, so a full suite run costs three
// logins instead of one per test.
mkdirSync('e2e/.auth', { recursive: true })

setup('authenticate student', async ({ page }) => {
  await login(page, ACCOUNTS.student)
  await page.context().storageState({ path: 'e2e/.auth/student.json' })
})

setup('authenticate member', async ({ page }) => {
  await login(page, ACCOUNTS.member)
  await page.context().storageState({ path: 'e2e/.auth/member.json' })
})

setup('authenticate admin', async ({ page }) => {
  await login(page, ACCOUNTS.admin)
  await page.context().storageState({ path: 'e2e/.auth/admin.json' })
})
