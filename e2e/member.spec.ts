import { test, expect } from '@playwright/test'

// Runs with the shared member session (Casey Ortega) — no per-test login.

test('member home shows their offers and incoming hands', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Hey, Casey' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your offers' })).toBeVisible()
  await expect(page.getByText('Shadow a large-animal vet for a day')).toBeVisible()
})

test('member sees hand-raises with the student note on the manage page', async ({ page }) => {
  await page.goto('/home')
  await page.getByText('Shadow a large-animal vet for a day').click()
  await expect(page).toHaveURL(/\/offers\/.+\/manage/)
  await expect(page.getByText('Avery Kim')).toBeVisible()
  await expect(page.getByText('I work the morning shift on the school farm', { exact: false })).toBeVisible()
  await expect(page.getByText('Accepted').first()).toBeVisible()
})

test('the offer form is two required fields', async ({ page }) => {
  await page.goto('/offers/new')
  await expect(page.getByRole('heading', { name: 'Open a door' })).toBeVisible()
  await expect(page.getByLabel('Title')).toBeVisible()
  await expect(page.getByLabel("What you're offering")).toBeVisible()
  // Publish stays disabled until the two required fields are filled.
  await expect(page.getByRole('button', { name: 'Put it on the board' })).toBeDisabled()
  await page.getByLabel('Title').fill('E2E probe title')
  await page.getByLabel("What you're offering").fill('Probe body')
  await expect(page.getByRole('button', { name: 'Put it on the board' })).toBeEnabled()
})

test('member cannot reach the staff desk', async ({ page }) => {
  await page.goto('/admin/people')
  await expect(page).toHaveURL(/\/home/)
})
