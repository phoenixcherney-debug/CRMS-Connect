import { test, expect } from '@playwright/test'
import { ACCOUNTS, apiToken, restInsert, AVERY_ID } from './helpers'

// Runs with the shared admin session (CRMS staff) — no per-test login.

const CASEY_SHADOW_OFFER = 'd0000000-0000-4000-8000-000000000001'

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

test('admin resolves a filed report from the moderation queue', async ({ page, request }) => {
  // File a report as a student via the API, then action it through the staff UI.
  const reason = `E2E resolve-from-queue ${Date.now()}`
  const averyTok = await apiToken(request, ACCOUNTS.student)
  const ins = await restInsert(request, averyTok, 'reports', {
    reporter_id: AVERY_ID, target: 'offer', target_id: CASEY_SHADOW_OFFER, reason,
  })
  expect(ins.ok()).toBeTruthy()

  await page.goto('/admin/reports')
  const card = page.locator('li', { hasText: reason })
  await expect(card).toBeVisible({ timeout: 10_000 })
  await card.getByRole('button', { name: 'Mark resolved' }).click()
  await expect(page.getByText('Marked resolved', { exact: false })).toBeVisible({ timeout: 10_000 })
  // Reports have no delete policy, so it stays as a settled record (test-only DB).
})

test('admin can unlist an offer and restore it', async ({ page }) => {
  // Idempotent: unlist then restore leaves the board exactly as it started.
  await page.goto('/admin/offers')
  const row = page.locator('li', { hasText: 'Design a backyard studio with a working architect' }).first()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Unlist' }).click()
  await expect(row.getByText('Unlisted')).toBeVisible({ timeout: 10_000 })
  await expect(row.getByRole('button', { name: 'Restore' })).toBeVisible()

  await row.getByRole('button', { name: 'Restore' }).click()
  await expect(row.getByRole('button', { name: 'Unlist' })).toBeVisible({ timeout: 10_000 })
})
