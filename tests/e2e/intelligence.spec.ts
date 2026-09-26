import { expect, loginAsDemo, test } from './fixtures'

test.describe('@smoke intelligence', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
  })

  test('health score explains itself, and a one-click reorder → validate removes the alert', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/')
    const factors = page.getByRole('list', { name: 'Health score factors' })
    await expect(factors.getByRole('listitem')).toHaveCount(4)
    await expect(factors).toContainText('Stock availability')
    await expect(page.getByTestId('health-grade')).toHaveText(/Excellent|Good|Fair|Critical/)

    const before = await (await page.request.get('/api/dashboard/insights')).json()
    const target = before.alerts.items.find((p: { status: string; reorder: unknown }) => p.status === 'low' && p.reorder)
    await page.getByRole('button', { name: new RegExp(`^Reorder .* of ${target.name}$`) }).click()

    await expect(page).toHaveURL(/\/operations\/receipts\/\d+$/)
    await expect(page.getByText(/drafted for/)).toBeVisible()
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Validate receipt' }).click()
    await expect(page.getByText(/validated — stock updated/)).toBeVisible()

    const after = await (await page.request.get('/api/dashboard/insights')).json()
    expect(after.alerts.total).toBe(before.alerts.total - 1)
    expect(after.health.score).toBeGreaterThanOrEqual(before.health.score)
  })

  test('the movement chart has a table view with 30 days', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Show table' }).click()
    await expect(page.getByRole('table', { name: 'Stock flow by day' }).locator('tbody tr')).toHaveCount(30)
  })

  test('⌘K finds a product by SKU and opens it', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('table', { name: 'Operations overview' }).waitFor()
    await page.keyboard.press('Control+k')
    await page.getByPlaceholder(/Type a page, an action/).fill('RM-STL-012')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Steel Rods 12mm' })).toBeVisible()
  })

  test('live: a document created in another window updates this dashboard without a reload', async ({ page, browser }) => {
    test.setTimeout(60_000)
    await page.goto('/')
    // The stream can queue behind the page's first data requests (per-host connection limit).
    await expect(page.getByRole('status', { name: /^Live —/ })).toBeVisible({ timeout: 15_000 })
    const k0 = await (await page.request.get('/api/dashboard')).json()
    const kpi = page.getByRole('link', { name: /^Pending receipts:/ })
    await expect(kpi).toHaveAttribute('aria-label', new RegExp(`^Pending receipts: ${k0.pendingReceipts.pending}\\.`))

    // Another signed-in window drafts a receipt through the API.
    const other = await browser.newContext({ baseURL: new URL(page.url()).origin })
    await other.request.post('/api/auth/login', { data: { email: 'demo@stocksense.in', password: 'demo1234' } })
    const shelf = (await (await other.request.get('/api/locations')).json()).items.find((l: { fullName: string }) => l.fullName === 'HYD/Stock')
    const product = (await (await other.request.get('/api/products?q=RM-STL-012')).json()).items[0]
    const created = await other.request.post('/api/operations', {
      data: { type: 'receipt', partner: 'Tata Steel Distributors', destLocationId: shelf.id, lines: [{ productId: product.id, qty: 5 }] },
    })
    expect(created.ok()).toBe(true)
    await other.close()

    await expect(kpi).toHaveAttribute('aria-label', new RegExp(`^Pending receipts: ${k0.pendingReceipts.pending + 1}\\.`), { timeout: 10_000 })
  })

  test('theme toggle switches to dark and persists', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})
