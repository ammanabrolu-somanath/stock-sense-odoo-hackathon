import type { APIRequestContext, Page } from '@playwright/test'

import { expect, loginAsDemo, test } from './fixtures'

/**
 * The lifecycle of every document type, driven through the UI, with the ledger checked
 * through the API after each step (the screen is not the source of truth — the moves are).
 */
async function stockOf(request: APIRequestContext, productId: number) {
  const p = await (await request.get(`/api/products/${productId}`)).json()
  const at = (fullName: string) => p.stock.find((s: { fullName: string }) => s.fullName === fullName)?.qty ?? 0
  return { total: p.onHand as number, at }
}

async function pickLocation(page: Page, label: string, fullName: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: fullName, exact: true }).click()
}

async function pickProduct(page: Page, line: number, sku: string) {
  await page.getByRole('combobox', { name: `Product for line ${line}` }).click()
  await page.getByPlaceholder('Search name or SKU').fill(sku)
  await page.getByRole('option', { name: new RegExp(sku) }).click()
}

test.describe('@smoke operations', () => {
  test('receive → transfer → blocked over-delivery → pick/pack/validate → count; ledger reconciles', async ({ page }) => {
    // Five documents end to end through the UI — longer than the default per-test budget.
    test.setTimeout(90_000)
    await loginAsDemo(page)
    const request = page.request

    // A fresh product, so seeded history can't interfere with the arithmetic.
    const sku = `OPS-${Date.now().toString(36).toUpperCase()}`
    const categories = (await (await request.get('/api/categories')).json()).items
    const created = await request.post('/api/products', {
      data: { sku, name: `Pallet Jack ${sku}`, categoryId: categories[0].id, uom: 'unit', cost: 100, price: 150, reorderMin: 5, reorderMax: 60, leadTimeDays: 5 },
    })
    expect(created.ok()).toBe(true)
    const productId: number = (await created.json()).id

    // 1 · Receipt: +50 into HYD/Rack A (prefilled from the product, as "Receive stock" does)
    await page.goto(`/operations/receipts/new?productId=${productId}&qty=50`)
    await page.getByLabel('Supplier').fill('Godrej Interio')
    await pickLocation(page, 'Receive into', 'HYD/Rack A')
    await page.getByRole('button', { name: 'Create receipt' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/HYD\/IN\/\d{5}/)
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Validate receipt' }).click()
    await expect(page.getByText(/validated — stock updated/)).toBeVisible()
    await expect(page.getByText('Done', { exact: true }).first()).toBeVisible()
    let s = await stockOf(request, productId)
    expect([s.at('HYD/Rack A'), s.total]).toEqual([50, 50])

    // 2 · Transfer: 20 from Rack A to Rack B — total unchanged
    await page.goto('/operations/transfers/new')
    await pickLocation(page, 'From', 'HYD/Rack A')
    await pickLocation(page, 'To', 'HYD/Rack B')
    await pickProduct(page, 1, sku)
    await page.getByLabel('Quantity for line 1').fill('20')
    await page.getByRole('button', { name: 'Create transfer' }).click()
    await page.getByRole('button', { name: 'Validate transfer' }).click()
    await expect(page.getByText(/validated — stock updated/)).toBeVisible()
    s = await stockOf(request, productId)
    expect([s.at('HYD/Rack A'), s.at('HYD/Rack B'), s.total]).toEqual([30, 20, 50])

    // 3 · Over-delivery: 25 from Rack B (holds 20) — flagged while typing, then Waiting, nothing moves
    await page.goto('/operations/deliveries/new')
    await page.getByLabel('Customer').fill('Tata Projects')
    await pickLocation(page, 'Ship from', 'HYD/Rack B')
    await pickProduct(page, 1, sku)
    await page.getByLabel('Quantity for line 1').fill('25')
    await expect(page.getByText('Only 20 available')).toBeVisible()
    await page.getByRole('button', { name: 'Create delivery' }).click()
    await page.getByRole('button', { name: 'Confirm order' }).click()
    await expect(page.getByText('Waiting for stock at HYD/Rack B')).toBeVisible()
    await expect(page.getByText('20 of 25 units available')).toBeVisible()
    const waitingId = Number(page.url().split('/').pop())
    const forced = await request.post(`/api/operations/${waitingId}/validate`)
    expect(forced.status()).toBe(409)
    expect((await forced.json()).error.message).toBe(`Only 20 units of Pallet Jack ${sku} on hand at HYD/Rack B — 25 units requested.`)
    await page.getByRole('button', { name: 'Cancel document' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel document' }).click()
    await expect(page.getByText('Canceled. No stock was moved.')).toBeVisible()
    s = await stockOf(request, productId)
    expect(s.total).toBe(50)

    // 4 · Delivery: 25 from Rack A — confirm → pick → pack → validate
    await page.goto('/operations/deliveries/new')
    await page.getByLabel('Customer').fill('L&T Construction')
    await pickLocation(page, 'Ship from', 'HYD/Rack A')
    await pickProduct(page, 1, sku)
    await page.getByLabel('Quantity for line 1').fill('25')
    await page.getByRole('button', { name: 'Create delivery' }).click()
    await page.getByRole('button', { name: 'Confirm order' }).click()
    const validate = page.getByRole('button', { name: 'Validate delivery' })
    await expect(validate).toBeDisabled()
    await page.getByRole('button', { name: 'Pick all' }).click()
    await expect(page.getByText('1 of 1 lines picked')).toBeVisible()
    await page.getByRole('button', { name: 'Mark packed' }).click()
    await expect(validate).toBeEnabled()
    await validate.click()
    await expect(page.getByText(/validated — stock updated/)).toBeVisible()
    s = await stockOf(request, productId)
    expect([s.at('HYD/Rack A'), s.total]).toEqual([5, 25])

    // 5 · Adjustment: count 18 on Rack B (recorded 20) → −2
    await page.goto('/operations/adjustments/new')
    await pickLocation(page, 'Counted location', 'HYD/Rack B')
    await page.getByRole('combobox', { name: 'Reason' }).click()
    await page.getByRole('option', { name: 'Damaged' }).click()
    await pickProduct(page, 1, sku)
    await page.getByLabel('Counted for line 1').fill('18')
    await expect(page.getByRole('cell', { name: '-2' })).toBeVisible()
    await page.getByRole('button', { name: 'Create adjustment' }).click()
    await page.getByRole('button', { name: 'Apply count' }).click()
    await expect(page.getByText(/validated — stock updated/)).toBeVisible()
    s = await stockOf(request, productId)
    expect([s.at('HYD/Rack A'), s.at('HYD/Rack B'), s.total]).toEqual([5, 18, 23])

    // The ledger: exactly four moves, and the running balance ends at on-hand.
    const moves = await (await request.get(`/api/moves?productId=${productId}`)).json()
    expect(moves.total).toBe(4)
    expect(moves.items[0].balance).toBe(23)
    expect(moves.items.map((m: { type: string }) => m.type).sort()).toEqual(['adjustment', 'delivery', 'receipt', 'transfer'])
  })

  test('lists filter by status from the URL and badges count open work', async ({ page }) => {
    await loginAsDemo(page)
    await page.goto('/operations/deliveries?status=waiting')
    const rows = page.locator('tbody tr[data-row]')
    await expect(rows.first()).toBeVisible()
    for (const row of await rows.all()) await expect(row).toContainText('Waiting')
    const counts = await (await page.request.get('/api/operations/counts')).json()
    const badge = page.getByRole('link', { name: /Receipts/ }).locator('..').getByText(String(counts.receipt.pending), { exact: true })
    await expect(badge).toBeVisible()
  })
})
