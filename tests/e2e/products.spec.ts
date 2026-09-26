import { expect, loginAsDemo, test } from './fixtures'

test.describe('@smoke products', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page)
  })

  test('search, filter from the URL, and open a product from the keyboard', async ({ page }) => {
    await page.goto('/products')
    const rows = page.locator('tbody tr[data-row]')
    await expect(rows.first()).toBeVisible()
    expect(await rows.count()).toBeGreaterThan(20)

    await page.getByRole('textbox', { name: 'Search by name or SKU' }).fill('steel')
    await expect(page).toHaveURL(/q=steel/)
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('RM-STL-012')

    await page.goto('/products?status=out')
    await expect(rows.first()).toContainText('UPS 1kVA')
    await expect(page.getByRole('combobox', { name: 'Stock' })).toContainText('Out of stock')

    await rows.first().focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'UPS 1kVA' })).toBeVisible()
    await expect(page.getByText('Out of stock').first()).toBeVisible()
  })

  test('create a product with opening stock → detail shows stock and its ledger move', async ({ page }) => {
    const sku = `E2E-${Date.now().toString(36).toUpperCase()}`
    await page.goto('/products')
    await page.getByRole('button', { name: /New product/ }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByLabel('Name').fill('Wireless Barcode Scanner')
    await sheet.getByLabel('SKU / Code').fill(sku)
    await sheet.getByRole('combobox', { name: 'Category' }).click()
    await page.getByRole('option', { name: 'Electronics' }).click()
    await sheet.getByLabel('Cost (₹)').fill('2800')
    await sheet.getByLabel('Sale price (₹)').fill('3999')
    await sheet.getByLabel('Minimum').fill('5')
    await sheet.getByLabel('Maximum').fill('30')
    await sheet.getByRole('combobox', { name: 'Location' }).click()
    await page.getByRole('option', { name: 'HYD/Stock' }).click()
    await sheet.getByLabel('Quantity').fill('12')
    await sheet.getByRole('button', { name: 'Create product' }).click()

    await expect(page).toHaveURL(/\/products\/\d+$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Wireless Barcode Scanner' })).toBeVisible()
    await expect(page.getByText(sku)).toBeVisible()
    const locationTable = page.getByRole('table', { name: 'Stock by location' })
    await expect(locationTable).toContainText('HYD/Stock')
    await expect(locationTable).toContainText('12 units')
    const moves = page.getByRole('table', { name: 'Recent movements' })
    await expect(moves).toContainText('Adjustment')
    await expect(moves).toContainText('+12')
  })

  test('the form explains what is wrong before anything is sent', async ({ page }) => {
    await page.goto('/products')
    await expect(page.locator('tbody tr[data-row]').first()).toBeVisible()
    await page.keyboard.press('n')
    const sheet = page.getByRole('dialog')
    await sheet.getByLabel('Minimum').fill('50')
    await sheet.getByLabel('Maximum').fill('10')
    await sheet.getByLabel('Quantity').fill('5')
    await sheet.getByRole('button', { name: 'Create product' }).click()
    await expect(sheet.getByText('Enter a product name.')).toBeVisible()
    await expect(sheet.getByText('Choose a category.')).toBeVisible()
    await expect(sheet.getByText('Maximum must be at least the minimum.')).toBeVisible()
    await expect(sheet.getByText('Choose where the stock is.')).toBeVisible()
  })
})
