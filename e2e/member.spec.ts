import { test, expect } from '@playwright/test'
import { ACCOUNTS, apiToken, restDelete, restInsert, AVERY_ID } from './helpers'

// Runs with the shared member session (Casey Ortega) — no per-test login.

const CASEY_ID = 'b0000000-0000-4000-8000-000000000001'

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
    // Assert the cleanup actually ran: an unchecked delete used to leave
    // `E2E published offer <ts>` rows on the shared board permanently, degrading
    // every later board/search assertion.
    const delPub = await restDelete(request, adminTok, 'offers', `title=eq.${encodeURIComponent(pubTitle)}`)
    expect(delPub.ok(), 'cleanup of the published E2E offer failed').toBeTruthy()
    const delDraft = await restDelete(request, adminTok, 'offers', `title=eq.${encodeURIComponent(draftTitle)}`)
    expect(delDraft.ok(), 'cleanup of the draft E2E offer failed').toBeTruthy()
  }
})

test('member cannot reach the staff desk', async ({ page }) => {
  await page.goto('/admin/people')
  await expect(page).toHaveURL(/\/home/)
})

// --- The poster's decide path (review: no e2e coverage in any role project) ---
//
// The DB transitions are covered in integration/rls.test.ts; what was never
// driven through the UI is Thread.tsx's decide() — the confirmation modals, the
// sent→in_conversation advance on first reply, and the guard that aborts a
// decline when the softening note fails to post. A broken Accept button or a
// modal that never closes shipped with a fully green suite.
//
// Serial: both tests arrange a throwaway offer + knock and clean it up. Note the
// cleanup order — requests.offer_id is ON DELETE RESTRICT since the
// cascade-delete blocker, so the thread must be removed before the offer.
test.describe.serial('poster accept / decline through the UI', () => {
  async function arrangeKnock(request: import('@playwright/test').APIRequestContext, title: string) {
    const caseyTok = await apiToken(request, ACCOUNTS.member)
    const averyTok = await apiToken(request, ACCOUNTS.student)
    const offerRes = await restInsert(request, caseyTok, 'offers', {
      posted_by: CASEY_ID, kind: 'career_chat', title,
      description: 'E2E decide-path offer — safe to remove.', spots: 1, status: 'open',
    })
    expect(offerRes.ok(), 'arrange: offer insert failed').toBeTruthy()
    const offerId = (await offerRes.json())[0].id as string

    const reqRes = await restInsert(request, averyTok, 'requests', {
      offer_id: offerId, student_id: AVERY_ID, note: 'E2E decide-path knock — please ignore.',
    })
    expect(reqRes.ok(), 'arrange: request insert failed').toBeTruthy()
    const requestId = (await reqRes.json())[0].id as string
    return { offerId, requestId }
  }

  async function cleanUp(request: import('@playwright/test').APIRequestContext, offerId: string) {
    const adminTok = await apiToken(request, ACCOUNTS.admin)
    const delReq = await restDelete(request, adminTok, 'requests', `offer_id=eq.${offerId}`)
    expect(delReq.ok(), 'cleanup: request delete failed').toBeTruthy()
    const delOffer = await restDelete(request, adminTok, 'offers', `id=eq.${offerId}`)
    expect(delOffer.ok(), 'cleanup: offer delete failed').toBeTruthy()
  }

  test('poster replies, the status advances, then Accept fills the offer', async ({ page, request }) => {
    const title = `E2E accept-path offer ${Date.now()}`
    const { offerId, requestId } = await arrangeKnock(request, title)
    try {
      await page.goto(`/requests/${requestId}`)
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 })

      // First poster reply advances sent → in_conversation.
      await page.getByLabel('Reply').fill('Happy to talk — what works for you?')
      await page.getByRole('button', { name: 'Send' }).click()
      await expect(page.getByText('In conversation').first()).toBeVisible({ timeout: 15_000 })

      // Accept, through the confirmation modal.
      await page.getByRole('button', { name: 'Accept', exact: true }).click()
      await page.getByRole('button', { name: 'Accept', exact: true }).last().click()
      await expect(page.getByText('Accepted', { exact: false }).first()).toBeVisible({ timeout: 15_000 })

      // Accepting a single-spot offer fills it (notify_request_updated).
      await page.goto(`/offers/${offerId}/manage`)
      await expect(page.getByText('Filled').first()).toBeVisible({ timeout: 15_000 })
    } finally {
      await cleanUp(request, offerId)
    }
  })

  test('Decline posts the softening note as a message before the status changes', async ({ page, request }) => {
    const title = `E2E decline-path offer ${Date.now()}`
    const { offerId, requestId } = await arrangeKnock(request, title)
    try {
      await page.goto(`/requests/${requestId}`)
      await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 })

      await page.getByRole('button', { name: 'Decline' }).click()
      const note = page.getByLabel('Message to the student')
      await expect(note).toBeVisible()
      // The template is pre-filled and sent as a real message.
      const templateText = await note.inputValue()
      expect(templateText.length).toBeGreaterThan(10)
      await page.getByRole('button', { name: 'Send & decline' }).click()

      // The note lands in the transcript, and only then does the status move.
      await expect(page.getByText(templateText, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('Declined', { exact: false }).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText('This thread is closed', { exact: false })).toBeVisible()
    } finally {
      await cleanUp(request, offerId)
    }
  })
})
