import { test, expect } from '@playwright/test'

// Runs with the shared admin session (CRMS staff) — no per-test login.

test('admin lands on the staff desk with the approval queue', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin/)
  // The queue heading always renders; its contents depend on who's pending, so
  // don't hard-code a name that staff may have already worked through.
  await expect(page.getByRole('heading', { name: 'Approval queue' })).toBeVisible()
  await expect(page.getByText('waiting for approval')).toBeVisible()
})

test('admin can read any thread as staff', async ({ page }) => {
  await page.goto('/admin/requests')
  await expect(page.getByRole('heading', { name: 'Requests & threads' })).toBeVisible()
  await page.getByText('Shadow a large-animal vet for a day').first().click()
  await expect(page).toHaveURL(/\/requests\//)
  await expect(page.getByText("You're viewing as staff", { exact: false })).toBeVisible()
})

test('audit log and reports pages load', async ({ page }) => {
  await page.goto('/admin/audit')
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible()
  await page.goto('/admin/reports')
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
})
