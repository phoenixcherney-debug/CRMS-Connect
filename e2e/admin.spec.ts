import { test, expect } from '@playwright/test'
import { ACCOUNTS, apiToken, restInsert, restPatch, AVERY_ID } from './helpers'

// Runs with the shared admin session (CRMS staff) — no per-test login.

const CASEY_SHADOW_OFFER = 'd0000000-0000-4000-8000-000000000001'
// The gating fixture e2e/gating.spec.ts signs in as; restored in `finally`.
const PENDING_DEMO_ID = 'a0000000-0000-4000-8000-0000000000fe'
const PENDING_DEMO_NAME = 'Pending Demo'

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

// Approving an adult is what grants access to a community of minors, and
// disabling is what revokes it — neither UI path was ever clicked in a test, and
// /admin/people was never visited as admin at all. Mirrors the idempotent
// unlist/restore pattern below: act through the UI, restore via PATCH in
// `finally` so gating.spec.ts's fixtures survive.
test('staff approve a pending account through the people desk, then restore it', async ({ page, request }) => {
  const adminTok = await apiToken(request, ACCOUNTS.admin)
  try {
    await page.goto('/admin/people')
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible({ timeout: 15_000 })

    const row = page.locator('li', { hasText: PENDING_DEMO_NAME }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    await row.getByRole('button', { name: 'Approve' }).click()
    // AdminPeople toasts "<name> is in." on approval.
    await expect(page.getByText(`${PENDING_DEMO_NAME} is in.`)).toBeVisible({ timeout: 15_000 })
    await expect(row.getByText('Active', { exact: false })).toBeVisible({ timeout: 15_000 })

    // And the revoke half: disabling is the other side of the same control.
    await row.getByRole('button', { name: 'Disable' }).click()
    await expect(row.getByText('Disabled', { exact: false })).toBeVisible({ timeout: 15_000 })
  } finally {
    const restore = await restPatch(request, adminTok, 'profiles', `id=eq.${PENDING_DEMO_ID}`, {
      account_status: 'pending', approved_at: null, approved_by: null,
    })
    expect(restore.ok(), 'failed to restore the pending.demo gating fixture').toBeTruthy()
  }
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
