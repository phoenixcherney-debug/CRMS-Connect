import { test, expect } from '@playwright/test'

test('landing page pitches the closed community', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'The doors only Oysters can open.' })).toBeVisible()
  await expect(page.getByText('Every adult is vouched for')).toBeVisible()
  await expect(page.getByRole('link', { name: "I'm a CRMS student" })).toBeVisible()
})

test('privacy page states the safety model', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy & safety' })).toBeVisible()
  await expect(page.getByText('Adults cannot browse students')).toBeVisible()
})

test('the board requires an account', async ({ page }) => {
  await page.goto('/board')
  await expect(page).toHaveURL(/\/login/)
})

test('signup offers both roles and explains member review', async ({ page }) => {
  await page.goto('/signup?role=member')
  await expect(page.getByRole('radio', { name: 'Alum, parent, or friend' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('reviewed by CRMS staff')).toBeVisible()
})
