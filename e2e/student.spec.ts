import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { ACCOUNTS, apiToken, restDelete } from './helpers'

// Runs with the shared student session (see auth.setup.ts + the 'student'
// project in playwright.config.ts) — no per-test login.

const PRIYA_STUDIO_OFFER = 'd0000000-0000-4000-8000-000000000004'
const CASEY_MENTOR_OFFER = 'd0000000-0000-4000-8000-000000000005' // open, Avery has no knock here
const JORDAN_CHAT_OFFER = 'd0000000-0000-4000-8000-000000000003' // Avery has an in_conversation knock here
const AVERY_ID = 'c0000000-0000-4000-8000-000000000001'

// Delete any leftover retractable request so the knock test starts clean (uses
// the requests_delete "retract" policy — which now also requires the thread to
// be empty, so this only ever clears an untouched knock). Goes through the
// shared REST helpers rather than re-deriving the URL/key, which used to
// default to '' here and silently no-op.
async function retractPriyaRequest(request: APIRequestContext) {
  const token = await apiToken(request, ACCOUNTS.student)
  const res = await restDelete(
    request, token, 'requests',
    `offer_id=eq.${PRIYA_STUDIO_OFFER}&student_id=eq.${AVERY_ID}`,
  )
  expect(res.ok(), 'cleanup of the leftover Priya knock failed').toBeTruthy()
}

test('student sees home, board, and poster identity', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Hey, Avery' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'The Board' }).click()
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible()
  await expect(page.getByText('Shadow a large-animal vet for a day')).toBeVisible()
  // Affiliation is the trust signal — it must render next to the poster.
  await expect(page.getByText('Class of ’02').first()).toBeVisible()
})

test('board keyword + type filters narrow the results server-side', async ({ page }) => {
  await page.goto('/board')
  await expect(page.getByText('Shadow a large-animal vet for a day')).toBeVisible()
  // Keyword search (debounced, pushed into the query).
  await page.getByLabel('Search offers by keyword').fill('internship')
  await expect(page.getByText('Paid summer internship: junior web developer')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Shadow a large-animal vet for a day')).toHaveCount(0)
  // Clear, then filter by type via the chip.
  await page.getByLabel('Search offers by keyword').fill('')
  await page.getByRole('button', { name: 'Career chat' }).click()
  await expect(page.getByText('30 minutes on studying CS in college')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Shadow a large-animal vet for a day')).toHaveCount(0)
})

test('student can open an offer and sees the knock form', async ({ page }) => {
  await page.goto('/board')
  await page.getByText('Paid summer internship: junior web developer').click()
  await expect(page.getByRole('heading', { name: 'Knock on the door' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Knock on the door' })).toBeVisible()
  // No contact info ever renders on offers.
  await expect(page.locator('main')).not.toContainText('@example.com')
})

test('the knock note requires at least 10 characters', async ({ page }) => {
  await page.goto(`/board/${CASEY_MENTOR_OFFER}`)
  await expect(page.getByRole('heading', { name: 'Knock on the door' })).toBeVisible()
  await page.getByLabel('Your note').fill('too short')
  await expect(page.getByRole('button', { name: 'Knock on the door' })).toBeDisabled()
  await page.getByLabel('Your note').fill('This is a long enough note to enable the button.')
  await expect(page.getByRole('button', { name: 'Knock on the door' })).toBeEnabled()
})

test('an already-knocked offer shows the status card, not the form', async ({ page }) => {
  await page.goto(`/board/${JORDAN_CHAT_OFFER}`)
  await expect(page.getByText('You knocked', { exact: false })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Knock on the door' })).toHaveCount(0)
})

test('the flag-for-staff form requires a real reason', async ({ page }) => {
  await page.goto(`/board/${CASEY_MENTOR_OFFER}`)
  await page.getByRole('button', { name: 'Flag for staff' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('What happened?').fill('ab')
  await expect(dialog.getByRole('button', { name: 'Send to staff' })).toBeDisabled()
  await dialog.getByLabel('What happened?').fill('This looks off to me.')
  await expect(dialog.getByRole('button', { name: 'Send to staff' })).toBeEnabled()
  // Close without submitting (reports can't be deleted afterward).
  await dialog.getByRole('button', { name: 'Cancel' }).click()
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

test('student can knock and then withdraw it', async ({ page, request }) => {
  // Uses Priya's studio offer (no seeded thread for Avery). Idempotent: clears
  // any prior request first, then knocks and withdraws through the UI.
  await retractPriyaRequest(request)

  await page.goto(`/board/${PRIYA_STUDIO_OFFER}`)
  await expect(page.getByRole('heading', { name: 'Knock on the door' })).toBeVisible()
  await page.getByLabel('Your note').fill('E2E — trying out the knock flow, please ignore.')
  await page.getByRole('button', { name: 'Knock on the door' }).click()

  await expect(page).toHaveURL(/\/requests\//, { timeout: 15_000 })
  await expect(page.getByText('CRMS staff can read this thread')).toBeVisible()

  // Withdraw so the offer's single spot is freed and the run is repeatable.
  await page.getByRole('button', { name: 'Withdraw my knock' }).click()
  await expect(page.getByText('Withdrawn').first()).toBeVisible({ timeout: 10_000 })

  await retractPriyaRequest(request)
})

// --- Error / empty-state branches, forced via route interception (T-06) ------

test('the board surfaces a load error instead of a blank page', async ({ page }) => {
  await page.route('**/rest/v1/offers**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) }))
  await page.goto('/board')
  await expect(page.getByText("The board didn't load")).toBeVisible({ timeout: 10_000 })
})

test('the board shows an empty state when no offers come back', async ({ page }) => {
  await page.route('**/rest/v1/offers**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.goto('/board')
  await expect(page.getByText('The board is quiet right now')).toBeVisible({ timeout: 10_000 })
})

test('my requests surfaces a load error', async ({ page }) => {
  await page.route('**/rest/v1/requests**', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'boom' }) }))
  await page.goto('/requests')
  await expect(page.getByText('load your requests', { exact: false })).toBeVisible({ timeout: 10_000 })
})

test('a nonexistent thread shows a friendly not-found, not a crash', async ({ page }) => {
  await page.goto('/requests/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText("This thread doesn't exist", { exact: false })).toBeVisible({ timeout: 10_000 })
})

test('student cannot reach the staff desk', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/home/)
  await expect(page.getByRole('heading', { name: 'Hey, Avery' })).toBeVisible()
})
