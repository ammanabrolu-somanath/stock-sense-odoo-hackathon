import { expect, loginAsDemo, test } from './fixtures'

/**
 * The problem statement's own worked example, replayed exactly:
 *   Step 1  Receive 100 kg steel                       → stock +100
 *   Step 2  Internal transfer Main Store → Production Rack → total unchanged, location updated
 *   Step 3  Deliver 20                                  → −20
 *   Step 4  3 kg damaged                                → −3
 *   "Everything logged in the Stock Ledger."
 * Seeded "Steel Rods 12mm" (kg) is used; assertions are on deltas from its current state.
 */
test('@smoke the spec’s steel example: +100, move, −20, −3, all in the ledger', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsDemo(page)
  const api = page.request
  const steel = (await (await api.get('/api/products?q=RM-STL-012')).json()).items[0]
  const locs = (await (await api.get('/api/locations')).json()).items as { id: number; fullName: string }[]
  const mainStore = locs.find((l) => l.fullName === 'HYD/Stock')!
  const productionRack = locs.find((l) => l.fullName === 'HYD/Production Floor')!
  const onHand = async () => {
    const p = await (await api.get(`/api/products/${steel.id}`)).json()
    const at = (id: number) => p.stock.find((s: { locationId: number }) => s.locationId === id)?.qty ?? 0
    return { total: p.onHand as number, store: at(mainStore.id), rack: at(productionRack.id) }
  }
  const run = async (body: object, actions: string[]) => {
    const op = await (await api.post('/api/operations', { data: body })).json()
    for (const a of actions) {
      const res = await api.post(`/api/operations/${op.id}/${a}`)
      expect(res.ok(), `${a}: ${await res.text()}`).toBe(true)
    }
    return op.reference as string
  }
  const start = await onHand()
  const movesBefore = (await (await api.get(`/api/moves?productId=${steel.id}&pageSize=1`)).json()).total

  // Step 1: receive 100 kg
  const r1 = await run({ type: 'receipt', partner: 'Tata Steel Distributors', destLocationId: mainStore.id, lines: [{ productId: steel.id, qty: 100 }] }, ['validate'])
  let now = await onHand()
  expect(now.total - start.total).toBe(100)

  // Step 2: Main Store → Production Rack (total unchanged, location updated)
  const r2 = await run({ type: 'transfer', sourceLocationId: mainStore.id, destLocationId: productionRack.id, lines: [{ productId: steel.id, qty: 100 }] }, ['validate'])
  now = await onHand()
  expect(now.total - start.total).toBe(100)
  expect(now.rack - start.rack).toBe(100)
  expect(now.store).toBe(start.store)

  // Step 3: deliver 20 (pick → pack → validate)
  const r3 = await run({ type: 'delivery', partner: 'L&T Construction', sourceLocationId: productionRack.id, lines: [{ productId: steel.id, qty: 20 }] }, [
    'confirm',
    'pick',
    'pack',
    'validate',
  ])
  now = await onHand()
  expect(now.total - start.total).toBe(80)

  // Step 4: 3 kg damaged — counted 3 less than recorded on the rack
  const r4 = await run(
    { type: 'adjustment', destLocationId: productionRack.id, reason: 'Damaged', lines: [{ productId: steel.id, qty: now.rack - 3 }] },
    ['validate'],
  )
  now = await onHand()
  expect(now.total - start.total).toBe(77)

  // Everything logged in the Stock Ledger — visible in Move History.
  const ledger = await (await api.get(`/api/moves?productId=${steel.id}&pageSize=4`)).json()
  expect(ledger.total - movesBefore).toBe(4)
  expect(ledger.items.map((m: { reference: string }) => m.reference).reverse()).toEqual([r1, r2, r3, r4])
  expect(ledger.items.map((m: { delta: number }) => m.delta).reverse()).toEqual([100, 0, -20, -3])
  expect(ledger.items[0].balance).toBe(now.total)

  await page.goto(`/moves?productId=${steel.id}`)
  await expect(page.getByRole('table', { name: 'Stock moves' })).toContainText(r4)
})
