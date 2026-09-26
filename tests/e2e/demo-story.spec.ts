import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

/**
 * The 3-minute pitch, clicked exactly as it will be presented (docs/DEMO.md). If this passes,
 * the demo works. Stock is verified through the API after each step, not just on screen.
 */
async function pickLocation(page: Page, label: string, fullName: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: fullName, exact: true }).click()
}
async function pickProduct(page: Page, sku: string) {
  await page.getByRole('combobox', { name: 'Product for line 1' }).click()
  await page.getByPlaceholder('Search name or SKU').fill(sku)
  await page.getByRole('option', { name: new RegExp(sku) }).click()
}

test('@smoke @demo the demo story, end to end', async ({ page }) => {
  test.setTimeout(150_000)
  const stock = async (id: number) => {
    const p = await (await page.request.get(`/api/products/${id}`)).json()
    return { total: p.onHand as number, at: (n: string) => p.stock.find((s: { fullName: string }) => s.fullName === n)?.qty ?? 0 }
  }

  // 1 · Login — the demo account is prefilled.
  await page.goto('/login')
  await page.getByRole('button', { name: 'Sign in' }).click()

  // 2 · Dashboard — KPIs, health, alerts.
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
  await expect(page.getByTestId('health-grade')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Low stock alerts' })).toBeVisible()

  // 3 · Create a product (no stock yet).
  const sku = `EL-SCN-${Date.now().toString(36).toUpperCase().slice(-5)}`
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Products' }).click()
  await page.getByRole('button', { name: /New product/ }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByLabel('Name').fill('Wireless Barcode Scanner')
  await sheet.getByLabel('SKU / Code').fill(sku)
  await sheet.getByRole('combobox', { name: 'Category' }).click()
  await page.getByRole('option', { name: 'Electronics' }).click()
  await sheet.getByLabel('Cost (₹)').fill('2800')
  await sheet.getByLabel('Sale price (₹)').fill('3999')
  await sheet.getByLabel('Minimum').fill('10')
  await sheet.getByLabel('Maximum').fill('60')
  await sheet.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Wireless Barcode Scanner' })).toBeVisible()
  const productId = Number(page.url().split('/').pop())
  expect((await stock(productId)).total).toBe(0)

  // 4 · Receive 50 into HYD/Stock ("Receive stock" pre-fills the product).
  await page.getByRole('link', { name: 'Receive stock' }).click()
  await page.getByLabel('Supplier').fill('Element14 India')
  await pickLocation(page, 'Receive into', 'HYD/Stock')
  await page.getByLabel('Quantity for line 1').fill('50')
  await page.getByRole('button', { name: 'Create receipt' }).click()
  await page.getByRole('button', { name: 'Validate receipt' }).click()
  await expect(page.getByText(/validated — stock updated/)).toBeVisible()
  expect((await stock(productId)).at('HYD/Stock')).toBe(50)

  // 5 · Transfer 20 to Bengaluru.
  await page.goto('/operations/transfers/new')
  await pickLocation(page, 'From', 'HYD/Stock')
  await pickLocation(page, 'To', 'BLR/Stock')
  await pickProduct(page, sku)
  await page.getByLabel('Quantity for line 1').fill('20')
  await page.getByRole('button', { name: 'Create transfer' }).click()
  await page.getByRole('button', { name: 'Validate transfer' }).click()
  await expect(page.getByText(/validated — stock updated/)).toBeVisible()
  let s = await stock(productId)
  expect([s.at('HYD/Stock'), s.at('BLR/Stock'), s.total]).toEqual([30, 20, 50])

  // 6 · Deliver: 40 is refused with the reason; 25 ships after pick & pack.
  await page.goto('/operations/deliveries/new')
  await page.getByLabel('Customer').fill('Reliance Retail')
  await pickLocation(page, 'Ship from', 'HYD/Stock')
  await pickProduct(page, sku)
  await page.getByLabel('Quantity for line 1').fill('40')
  await expect(page.getByText('Only 30 available')).toBeVisible()
  await page.getByLabel('Quantity for line 1').fill('25')
  await page.getByRole('button', { name: 'Create delivery' }).click()
  await page.getByRole('button', { name: 'Confirm order' }).click()
  await page.getByRole('button', { name: 'Pick all' }).click()
  await page.getByRole('button', { name: 'Mark packed' }).click()
  await page.getByRole('button', { name: 'Validate delivery' }).click()
  await expect(page.getByText(/validated — stock updated/)).toBeVisible()
  expect((await stock(productId)).at('HYD/Stock')).toBe(5)

  // 7 · Count: 2 damaged in Bengaluru (counted 18 of 20).
  await page.goto('/operations/adjustments/new')
  await pickLocation(page, 'Counted location', 'BLR/Stock')
  await page.getByRole('combobox', { name: 'Reason' }).click()
  await page.getByRole('option', { name: 'Damaged' }).click()
  await pickProduct(page, sku)
  await page.getByLabel('Counted for line 1').fill('18')
  await page.getByRole('button', { name: 'Create adjustment' }).click()
  await page.getByRole('button', { name: 'Apply count' }).click()
  await expect(page.getByText(/validated — stock updated/)).toBeVisible()
  s = await stock(productId)
  expect([s.at('HYD/Stock'), s.at('BLR/Stock'), s.total]).toEqual([5, 18, 23])

  // 8 · Move History: four moves, and the running balance ends at on-hand.
  await page.goto(`/products/${productId}`)
  await page.getByRole('link', { name: /23 units/ }).first().click()
  const moves = page.getByRole('table', { name: 'Stock moves' }).locator('tbody tr')
  await expect(moves).toHaveCount(4)
  await expect(moves.first().locator('td').last()).toHaveText('23 units')

  // 9 · Reorder from the dashboard alert, receive it, watch the alerts and score respond.
  const before = await (await page.request.get('/api/dashboard/insights')).json()
  const target = before.alerts.items.find((p: { status: string; reorder: unknown }) => p.status === 'low' && p.reorder)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' }).click()
  await page.getByRole('button', { name: new RegExp(`^Reorder .* of ${target.name}$`) }).click()
  await page.getByRole('button', { name: 'Validate receipt' }).click()
  await expect(page.getByText(/validated — stock updated/)).toBeVisible()
  const after = await (await page.request.get('/api/dashboard/insights')).json()
  expect(after.alerts.total).toBe(before.alerts.total - 1)
  expect(after.health.score).toBeGreaterThanOrEqual(before.health.score)
})
