import { test, expect } from '@playwright/test'

// Runs with the shared student session (see auth.setup.ts + the 'student'
// project in playwright.config.ts) — no per-test login.

test('student sees home, board, and poster identity', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Hey, Avery' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'The Board' }).click()
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible()
  await expect(page.getByText('Shadow a large-animal vet for a day')).toBeVisible()
  // Affiliation is the trust signal — it must render next to the poster.
  await expect(page.getByText('Class of ’02').first()).toBeVisible()
})

test('student can open an offer and sees the raise-hand form', async ({ page }) => {
  await page.goto('/board')
  await page.getByText('Paid summer internship: junior web developer').click()
  await expect(page.getByRole('heading', { name: 'Raise your hand' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Raise your hand' })).toBeVisible()
  // No contact info ever renders on offers.
  await expect(page.locator('main')).not.toContainText('@example.com')
})

test('student thread shows staff-visibility notice and accepts a message', async ({ page }) => {
  await page.goto('/requests')
  await page.getByText('Shadow a large-animal vet for a day').click()
  await expect(page.getByText('CRMS staff can read this thread')).toBeVisible()
  await expect(page.getByText('goat-shift experience is exactly the right qualification', { exact: false })).toBeVisible()

  const ping = `Checking in — e2e ${Date.now()}`
  await page.getByLabel('Reply').fill(ping)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText(ping)).toBeVisible({ timeout: 10_000 })
})

test('notifications page loads', async ({ page }) => {
  await page.goto('/notifications')
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible()
  // The push toggle self-hides unless VITE_VAPID_PUBLIC_KEY is set and a service
  // worker is available (built preview, not dev). Its opt-in state is verified
  // against a built preview separately; here we just guard the page render.
})

test('student cannot reach the staff desk', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('heading', { name: 'Hey, Avery' })).toBeVisible()
})
