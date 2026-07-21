import { test, expect } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

test.describe.configure({ mode: 'serial' })

test('student sees home, board, and poster identity', async ({ page }) => {
  await login(page, ACCOUNTS.student)
  await expect(page.getByRole('heading', { name: 'Hey, Avery' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'The Board' }).click()
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible()
  await expect(page.getByText('Shadow a large-animal vet for a day')).toBeVisible()
  // Affiliation is the trust signal — it must render next to the poster.
  await expect(page.getByText('Class of ’02').first()).toBeVisible()
})

test('student can open an offer and sees the raise-hand form', async ({ page }) => {
  await login(page, ACCOUNTS.student)
  await page.goto('/board')
  await page.getByText('Paid summer internship: junior web developer').click()
  await expect(page.getByRole('heading', { name: 'Raise your hand' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Raise your hand' })).toBeVisible()
  // No contact info ever renders on offers.
  await expect(page.locator('main')).not.toContainText('@example.com')
})

test('student thread shows staff-visibility notice and accepts a message', async ({ page }) => {
  await login(page, ACCOUNTS.student)
  await page.goto('/requests')
  await page.getByText('Shadow a large-animal vet for a day').click()
  await expect(page.getByText('CRMS staff can read this thread')).toBeVisible()
  await expect(page.getByText('goat-shift experience is exactly the right qualification', { exact: false })).toBeVisible()

  const ping = `Checking in — e2e ${Date.now()}`
  await page.getByLabel('Reply').fill(ping)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText(ping)).toBeVisible({ timeout: 10_000 })
})

test('student cannot reach the staff desk', async ({ page }) => {
  await login(page, ACCOUNTS.student)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('heading', { name: 'Hey, Avery' })).toBeVisible()
})
