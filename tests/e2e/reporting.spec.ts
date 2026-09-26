import { expect, loginAsDemo, test } from './fixtures'

test.describe('@smoke reporting', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
  })

  test('a product’s on-hand number traces to its ledger, whose running balance ends at that number', async ({ page }) => {
    const steel = (await (await page.request.get('/api/products?q=RM-STL-012')).json()).items[0]
    await page.goto(`/products/${steel.id}`)
    await page.getByRole('link', { name: /kg/ }).first().click()

    await expect(page).toHaveURL(new RegExp(`/moves\\?productId=${steel.id}`))
    await expect(page.getByRole('heading', { level: 1, name: 'Move History' })).toBeVisible()
    await expect(page.getByText('the newest row equals on-hand now')).toBeVisible()
    const table = page.getByRole('table', { name: 'Stock moves' })
    const firstBalance = table.locator('tbody tr').first().locator('td').last()
    const shown = Number((await firstBalance.innerText()).replace(/[^\d.]/g, ''))
    expect(shown).toBe(steel.onHand)
    await expect(page.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('href', `/api/moves.csv?productId=${steel.id}`)
  })

  test('move history pages on the server and filters by type', async ({ page }) => {
    await page.goto('/moves?type=receipt')
    const rows = page.getByRole('table', { name: 'Stock moves' }).locator('tbody tr')
    await expect(rows).toHaveCount(50)
    for (const row of (await rows.all()).slice(0, 10)) await expect(row).toContainText('Receipt')
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByText(/^51–100 of/)).toBeVisible()
  })

  test('each dashboard KPI opens a list of exactly that size, and filters rescope everything', async ({ page }) => {
    await page.goto('/')
    const k = await (await page.request.get('/api/dashboard')).json()
    await expect(page.getByRole('link', { name: `Low stock: ${k.lowStock}` })).toBeVisible()

    await page.getByRole('link', { name: `Low stock: ${k.lowStock}` }).click()
    await expect(page).toHaveURL(/\/products\?status=low/)
    await expect(page.locator('tbody tr[data-row]')).toHaveCount(k.lowStock)

    await page.goto('/')
    await page.getByRole('link', { name: /^Total products in stock/ }).click()
    await expect(page.locator('tbody tr[data-row]').first()).toBeVisible()
    await expect(page.getByText(new RegExp(`^${k.productsInStock} products? ·`))).toBeVisible()

    const whs = (await (await page.request.get('/api/warehouses')).json()).items
    const bom = whs.find((w: { code: string }) => w.code === 'BOM')
    const kb = await (await page.request.get(`/api/dashboard?warehouseId=${bom.id}`)).json()
    await page.goto(`/?warehouseId=${bom.id}`)
    await expect(page.getByRole('link', { name: new RegExp(`^Pending deliveries: ${kb.pendingDeliveries.pending}\\.`) })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Warehouse' })).toContainText('BOM')
  })

  test('the operations overview shows open work by default and follows the status filter', async ({ page }) => {
    await page.goto('/')
    const overview = page.getByRole('table', { name: 'Operations overview' })
    await expect(overview.locator('tbody tr[data-row]').first()).toBeVisible()
    for (const row of await overview.locator('tbody tr[data-row]').all()) {
      await expect(row).not.toContainText(/Done|Canceled/)
    }
    await page.goto('/?status=done&type=adjustment')
    await expect(page.getByRole('heading', { name: 'Operations', exact: true })).toBeVisible()
    for (const row of (await overview.locator('tbody tr[data-row]').all()).slice(0, 5)) {
      await expect(row).toContainText('Done')
      await expect(row).toContainText('Adjustment')
    }
  })

  test('settings: create a warehouse, then add a location to it', async ({ page }) => {
    const code = Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('')
    await page.goto('/settings/warehouses')
    await page.getByRole('button', { name: 'New warehouse' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Code', { exact: true }).fill(code)
    await dialog.getByLabel('Name', { exact: true }).fill('Chennai Port Store')
    await dialog.getByLabel('City', { exact: true }).fill('Chennai')
    await dialog.getByLabel('Capacity (units)').fill('4000')
    await dialog.getByRole('button', { name: 'Create warehouse' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Chennai Port Store' })).toBeVisible()
    const locations = page.getByRole('table', { name: /Locations in/ })
    await expect(locations).toContainText(`${code}/Stock`)
    await page.getByLabel('New location name').fill('Cold Room')
    await page.getByRole('button', { name: 'Add location' }).click()
    await expect(locations).toContainText(`${code}/Cold Room`)
  })
})
