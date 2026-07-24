import { test, expect } from '@playwright/test'
import { ACCOUNTS, apiToken, restDelete } from './helpers'

// Runs with the shared member session (Casey Ortega) — no per-test login.

test('member home shows their offers and incoming knocks', async ({ page }) => {
  await page.goto('/home')
  await expect(page.getByRole('heading', { name: 'Hey, Casey' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your offers' })).toBeVisible()
  await expect(page.getByText('Shadow a large-animal vet for a day')).toBeVisible()
})

test('member sees knocks with the student note on the manage page', async ({ page }) => {
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

test('member publishes an offer that lands on the board, and a draft that does not', async ({ page, request }) => {
  const stamp = Date.now()
  const pubTitle = `E2E published offer ${stamp}`
  const draftTitle = `E2E draft offer ${stamp}`
  const adminTok = await apiToken(request, ACCOUNTS.admin)
  try {
    // Publish → lands on the manage page, then shows on the board.
    await page.goto('/offers/new')
    await page.getByLabel('Title').fill(pubTitle)
    await page.getByLabel("What you're offering").fill('E2E body — please ignore, safe to remove.')
    await page.getByRole('button', { name: 'Put it on the board' }).click()
    await expect(page).toHaveURL(/\/offers\/.+\/manage/, { timeout: 15_000 })

    await page.goto('/board')
    await page.getByLabel('Search offers by keyword').fill(pubTitle)
    await expect(page.getByText(pubTitle)).toBeVisible({ timeout: 10_000 })

    // Draft → manage page shows a Draft badge, but it never reaches the board.
    await page.goto('/offers/new')
    await page.getByLabel('Title').fill(draftTitle)
    await page.getByLabel("What you're offering").fill('E2E draft body — please ignore.')
    await page.getByRole('button', { name: 'Save as draft' }).click()
    await expect(page).toHaveURL(/\/offers\/.+\/manage/, { timeout: 15_000 })
    await expect(page.getByText('Draft').first()).toBeVisible()

    await page.goto('/board')
    await page.getByLabel('Search offers by keyword').fill(draftTitle)
    await expect(page.getByText(draftTitle)).toHaveCount(0)
  } finally {
    await restDelete(request, adminTok, 'offers', `title=eq.${encodeURIComponent(pubTitle)}`)
    await restDelete(request, adminTok, 'offers', `title=eq.${encodeURIComponent(draftTitle)}`)
  }
})

test('member cannot reach the staff desk', async ({ page }) => {
  await page.goto('/admin/people')
  await expect(page).toHaveURL(/\/home/)
})
