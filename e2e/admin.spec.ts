import { test, expect } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

test('admin lands on the staff desk with the approval queue', async ({ page }) => {
  await login(page, ACCOUNTS.admin)
  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole('heading', { name: 'Approval queue' })).toBeVisible()
  // Robin Marsh is seeded pending — the queue must surface them.
  await expect(page.getByText('Robin Marsh')).toBeVisible()
})

test('admin can read any thread as staff', async ({ page }) => {
  await login(page, ACCOUNTS.admin)
  await page.goto('/admin/requests')
  await expect(page.getByRole('heading', { name: 'Requests & threads' })).toBeVisible()
  await page.getByText('Shadow a large-animal vet for a day').first().click()
  await expect(page).toHaveURL(/\/requests\//)
  await expect(page.getByText("You're viewing as staff", { exact: false })).toBeVisible()
})

test('audit log and reports pages load', async ({ page }) => {
  await login(page, ACCOUNTS.admin)
  await page.goto('/admin/audit')
  await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible()
  await page.goto('/admin/reports')
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible()
})
