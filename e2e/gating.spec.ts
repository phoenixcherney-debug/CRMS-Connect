import { test, expect } from '@playwright/test'

// Pending/disabled account gating. These accounts never reach /home, so they
// can't use the shared storageState projects — each logs in inline and asserts
// where the Gate sends it. (No auth setup dependency; runs in the 'public' project.)

const PENDING = { email: 'pending.demo@example.com', password: process.env.E2E_PASSWORD ?? '' }
const DISABLED = { email: 'disabled.demo@example.com', password: process.env.E2E_PASSWORD ?? '' }

async function signIn(page: import('@playwright/test').Page, account: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

test('a pending member is held in the waiting room', async ({ page }) => {
  await signIn(page, PENDING)
  await expect(page).toHaveURL(/\/waiting/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'A real person is checking' })).toBeVisible()
  // And can't slip into the app by typing a route.
  await page.goto('/board')
  await expect(page).toHaveURL(/\/waiting/)
})

test('a disabled account is sent to the disabled screen', async ({ page }) => {
  await signIn(page, DISABLED)
  await expect(page).toHaveURL(/\/disabled/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'This account is disabled' })).toBeVisible()
  await page.goto('/home')
  await expect(page).toHaveURL(/\/disabled/)
})
