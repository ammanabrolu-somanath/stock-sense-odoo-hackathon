import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { createContext, type AppContext } from './context.ts'
import { DEMO_USER } from './services/auth.service.ts'

/**
 * Every document type driven through its lifecycle over HTTP, asserting the ledger after
 * each step. Small deterministic world: HYD with Stock / Rack A / Rack B, two products.
 */
let ctx: AppContext
let agent: ReturnType<typeof request.agent>
let loc: { stock: number; rackA: number; rackB: number }
let steel: number
let helmet: number

beforeEach(async () => {
  ctx = createContext({ now: () => new Date('2026-09-26T06:00:00Z') })
  const c = ctx.catalog
  c.insertLocation({ warehouseId: null, name: 'Vendors', kind: 'vendor' })
  c.insertLocation({ warehouseId: null, name: 'Customers', kind: 'customer' })
  c.insertLocation({ warehouseId: null, name: 'Inventory adjustment', kind: 'adjustment' })
  const wh = c.insertWarehouse({ code: 'HYD', name: 'Hyderabad Main', city: 'Hyderabad', capacityUnits: 10_000 })
  loc = {
    stock: c.insertLocation({ warehouseId: wh, name: 'Stock', kind: 'internal' }),
    rackA: c.insertLocation({ warehouseId: wh, name: 'Rack A', kind: 'internal' }),
    rackB: c.insertLocation({ warehouseId: wh, name: 'Rack B', kind: 'internal' }),
  }
  const cat = c.insertCategory('Raw Materials')
  const base = { categoryId: cat, cost: 10, price: 12, reorderMin: 5, reorderMax: 50, leadTimeDays: 3, supplier: 'Tata Steel' }
  steel = c.insertProduct({ ...base, sku: 'RM-STL', name: 'Steel Rods', uom: 'kg' }, '2026-09-01T00:00:00Z')
  helmet = c.insertProduct({ ...base, sku: 'SF-HLM', name: 'Safety Helmet', uom: 'unit' }, '2026-09-01T00:00:00Z')
  ctx.auth.ensureUser(DEMO_USER)
  agent = request.agent(createApp(ctx))
  await agent.post('/api/auth/login').send({ email: DEMO_USER.email, password: DEMO_USER.password })
})

const at = (productId: number, locationId: number) => ctx.stock.qtyAt(productId, locationId)
const post = (path: string, body?: object) => agent.post(`/api/operations${path}`).send(body ?? {})

async function receive(productId: number, qty: number, dest = loc.stock) {
  const op = await post('', { type: 'receipt', partner: 'Tata Steel', destLocationId: dest, lines: [{ productId, qty }] })
  expect(op.status).toBe(201)
  const done = await post(`/${op.body.id}/validate`)
  expect(done.body.status).toBe('done')
  return done.body
}

describe('receipts', () => {
  it('draft → validate posts vendor → shelf and raises stock', async () => {
    const r = await receive(steel, 50)
    expect(r.reference).toBe('HYD/IN/00001')
    expect(at(steel, loc.stock)).toBe(50)
    expect(r.sourceLocation).toBe('Partners/Vendors')
    expect(r.doneAt).not.toBeNull()
  })

  it('confirm moves Draft → Ready; editing is only allowed in Draft', async () => {
    const op = await post('', { type: 'receipt', destLocationId: loc.stock, lines: [{ productId: steel, qty: 5 }] })
    const edited = await agent.patch(`/api/operations/${op.body.id}`).send({ lines: [{ productId: steel, qty: 7 }, { productId: helmet, qty: 2 }] })
    expect(edited.body.lines.map((l: { qty: number }) => l.qty)).toEqual([7, 2])
    expect((await post(`/${op.body.id}/confirm`)).body.status).toBe('ready')
    const late = await agent.patch(`/api/operations/${op.body.id}`).send({ lines: [{ productId: steel, qty: 1 }] })
    expect(late.status).toBe(409)
    expect(late.body.error.message).toMatch(/can't be edited because it is ready/)
  })
})

describe('deliveries: confirm → pick → pack → validate', () => {
  it('refuses to ship until every line is picked and the order packed', async () => {
    await receive(steel, 100)
    await receive(helmet, 30)
    const d = await post('', {
      type: 'delivery',
      partner: 'L&T',
      sourceLocationId: loc.stock,
      lines: [{ productId: steel, qty: 25 }, { productId: helmet, qty: 4 }],
    })
    expect((await post(`/${d.body.id}/confirm`)).body.status).toBe('ready')

    const early = await post(`/${d.body.id}/validate`)
    expect(early.status).toBe(409)
    expect(early.body.error.message).toMatch(/2 lines not picked/)

    const one = await post(`/${d.body.id}/pick`, { lineId: d.body.lines[0].id })
    expect(one.body.lines.map((l: { picked: boolean }) => l.picked)).toEqual([true, false])
    const packEarly = await post(`/${d.body.id}/pack`)
    expect(packEarly.status).toBe(409)
    expect(packEarly.body.error.message).toMatch(/1 line left/)

    await post(`/${d.body.id}/pick`)
    const packed = await post(`/${d.body.id}/pack`)
    expect(packed.body.packedAt).not.toBeNull()

    const done = await post(`/${d.body.id}/validate`)
    expect(done.body.status).toBe('done')
    expect(at(steel, loc.stock)).toBe(75)
    expect(at(helmet, loc.stock)).toBe(26)
    expect(done.body.destLocation).toBe('Partners/Customers')
  })

  it('unpicking a line unpacks the order', async () => {
    await receive(steel, 10)
    const d = await post('', { type: 'delivery', sourceLocationId: loc.stock, lines: [{ productId: steel, qty: 5 }] })
    await post(`/${d.body.id}/confirm`)
    await post(`/${d.body.id}/pick`)
    await post(`/${d.body.id}/pack`)
    const unpicked = await post(`/${d.body.id}/pick`, { lineId: d.body.lines[0].id, picked: false })
    expect(unpicked.body.packedAt).toBeNull()
    expect((await post(`/${d.body.id}/validate`)).status).toBe(409)
  })

  it('waits for stock, becomes ready when it arrives, and loses readiness (and picks) if stock goes elsewhere', async () => {
    const d = await post('', { type: 'delivery', partner: 'Apollo', sourceLocationId: loc.stock, lines: [{ productId: steel, qty: 40 }] })
    expect((await post(`/${d.body.id}/confirm`)).body.status).toBe('waiting')
    expect((await post(`/${d.body.id}/pick`)).status).toBe(409)

    await receive(steel, 40)
    expect((await post(`/${d.body.id}/check`)).body.status).toBe('ready')
    await post(`/${d.body.id}/pick`)

    // A competing transfer takes the stock first.
    const t = await post('', { type: 'transfer', sourceLocationId: loc.stock, destLocationId: loc.rackA, lines: [{ productId: steel, qty: 30 }] })
    await post(`/${t.body.id}/validate`)
    const recheck = await post(`/${d.body.id}/check`)
    expect(recheck.body.status).toBe('waiting')
    expect(recheck.body.lines[0].picked).toBe(false)
  })

  it('a packed delivery that loses its stock is moved back to Waiting (picks and pack reset) when validation fails', async () => {
    await receive(steel, 30)
    const d = await post('', { type: 'delivery', partner: 'L&T', sourceLocationId: loc.stock, lines: [{ productId: steel, qty: 25 }] })
    await post(`/${d.body.id}/confirm`)
    await post(`/${d.body.id}/pick`)
    await post(`/${d.body.id}/pack`)

    // A competing transfer drains the shelf before anyone presses Validate.
    const t = await post('', { type: 'transfer', sourceLocationId: loc.stock, destLocationId: loc.rackA, lines: [{ productId: steel, qty: 10 }] })
    await post(`/${t.body.id}/validate`)

    const res = await post(`/${d.body.id}/validate`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
    const after = (await agent.get(`/api/operations/${d.body.id}`)).body
    expect(after.status).toBe('waiting')
    expect(after.packedAt).toBeNull()
    expect(after.lines[0].picked).toBe(false)
    expect(at(steel, loc.stock)).toBe(20)
  })

  it('an over-delivery is blocked with the exact shortage and posts nothing', async () => {
    await receive(steel, 12)
    const d = await post('', { type: 'delivery', sourceLocationId: loc.stock, lines: [{ productId: steel, qty: 40 }] })
    await post(`/${d.body.id}/confirm`)
    const before = ctx.stock.countMoves()
    const res = await post(`/${d.body.id}/validate`)
    expect(res.status).toBe(409)
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      message: 'Only 12 kg of Steel Rods on hand at HYD/Stock — 40 kg requested.',
    })
    expect(res.body.error.details.shortages).toEqual([{ productId: steel, requested: 40, available: 12 }])
    expect(ctx.stock.countMoves()).toBe(before)
    expect(at(steel, loc.stock)).toBe(12)
  })

  it('shows availability at the source on open documents', async () => {
    await receive(steel, 12)
    const d = await post('', { type: 'delivery', sourceLocationId: loc.stock, lines: [{ productId: steel, qty: 40 }] })
    expect(d.body.lines[0].available).toBe(12)
  })
})

describe('transfers', () => {
  it('moves stock between racks without changing the total', async () => {
    await receive(steel, 100)
    const total = () => ctx.stock.onHandByProduct().get(steel)
    const t = await post('', { type: 'transfer', sourceLocationId: loc.stock, destLocationId: loc.rackA, lines: [{ productId: steel, qty: 60 }] })
    expect(t.body.reference).toBe('HYD/INT/00001')
    await post(`/${t.body.id}/validate`)
    const t2 = await post('', { type: 'transfer', sourceLocationId: loc.rackA, destLocationId: loc.rackB, lines: [{ productId: steel, qty: 20 }] })
    await post(`/${t2.body.id}/validate`)
    expect([at(steel, loc.stock), at(steel, loc.rackA), at(steel, loc.rackB)]).toEqual([40, 40, 20])
    expect(total()).toBe(100)
  })

  it('refuses a transfer the source cannot cover, even straight from Draft', async () => {
    await receive(steel, 5)
    const t = await post('', { type: 'transfer', sourceLocationId: loc.stock, destLocationId: loc.rackA, lines: [{ productId: steel, qty: 6 }] })
    const res = await post(`/${t.body.id}/validate`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK')
    expect([at(steel, loc.stock), at(steel, loc.rackA)]).toEqual([5, 0])
  })

  it('rejects receipts into, or deliveries from, virtual locations', async () => {
    const vendor = ctx.catalog.virtualLocation('vendor')
    const res = await post('', { type: 'delivery', sourceLocationId: vendor, lines: [{ productId: steel, qty: 1 }] })
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/is not a warehouse location/)
  })
})

describe('adjustments (counts)', () => {
  it('posts only the difference, records recorded-vs-counted, and handles all three cases', async () => {
    await receive(steel, 80)
    const down = await post('', { type: 'adjustment', destLocationId: loc.stock, reason: 'Damaged', lines: [{ productId: steel, qty: 77 }] })
    const doneDown = await post(`/${down.body.id}/validate`)
    expect(doneDown.body.lines[0]).toMatchObject({ qty: 77, systemQty: 80 })
    expect(at(steel, loc.stock)).toBe(77)

    const same = await post('', { type: 'adjustment', destLocationId: loc.stock, reason: 'Cycle count', lines: [{ productId: steel, qty: 77 }] })
    const movesBefore = ctx.stock.countMoves()
    expect((await post(`/${same.body.id}/validate`)).body.status).toBe('done')
    expect(ctx.stock.countMoves()).toBe(movesBefore)

    const found = await post('', { type: 'adjustment', destLocationId: loc.rackB, reason: 'Found', lines: [{ productId: helmet, qty: 3 }] })
    await post(`/${found.body.id}/validate`)
    expect(at(helmet, loc.rackB)).toBe(3)
    expect(ctx.stock.conservationCheck()).toEqual([])
  })

  it('rejects an unknown reason', async () => {
    const res = await post('', { type: 'adjustment', destLocationId: loc.stock, reason: 'Because', lines: [{ productId: steel, qty: 1 }] })
    expect(res.status).toBe(400)
  })
})

describe('cancellation and immutability', () => {
  it('cancels open documents; canceled and done documents cannot be validated or canceled again', async () => {
    const op = await post('', { type: 'receipt', destLocationId: loc.stock, lines: [{ productId: steel, qty: 5 }] })
    await post(`/${op.body.id}/confirm`)
    expect((await post(`/${op.body.id}/cancel`)).body.status).toBe('canceled')
    expect((await post(`/${op.body.id}/validate`)).status).toBe(409)
    expect(at(steel, loc.stock)).toBe(0)

    const done = await receive(steel, 5)
    const again = await post(`/${done.id}/cancel`)
    expect(again.status).toBe(409)
    expect(again.body.error.message).toMatch(/post an adjustment/)
    expect((await post(`/${done.id}/validate`)).status).toBe(409)
  })

  it('pick and pack only exist for deliveries', async () => {
    const op = await post('', { type: 'receipt', destLocationId: loc.stock, lines: [{ productId: steel, qty: 5 }] })
    await post(`/${op.body.id}/confirm`)
    expect((await post(`/${op.body.id}/pick`)).body.error.message).toMatch(/Only deliveries/)
  })
})

describe('read models for the operations screens', () => {
  it('counts open work per type, and lists stock on one shelf', async () => {
    await receive(steel, 20)
    await post('', { type: 'receipt', destLocationId: loc.stock, lines: [{ productId: helmet, qty: 1 }] })
    const d = await post('', { type: 'delivery', sourceLocationId: loc.stock, lines: [{ productId: steel, qty: 1 }] })
    await post(`/${d.body.id}/confirm`)
    const counts = (await agent.get('/api/operations/counts')).body
    expect(counts.receipt.pending).toBe(1)
    expect(counts.delivery.pending).toBe(1)
    expect(counts.transfer.pending).toBe(0)

    const shelf = (await agent.get(`/api/locations/${loc.stock}/stock`)).body.items
    expect(shelf).toEqual([{ productId: steel, qty: 20 }])
  })

  it('filters by status and searches by reference or partner', async () => {
    await receive(steel, 1)
    await post('', { type: 'receipt', partner: 'Hindalco', destLocationId: loc.stock, lines: [{ productId: steel, qty: 1 }] })
    const drafts = (await agent.get('/api/operations?type=receipt&status=draft')).body.items
    expect(drafts).toHaveLength(1)
    expect((await agent.get('/api/operations?q=hindalco')).body.items[0].partner).toBe('Hindalco')
    expect((await agent.get('/api/operations?q=HYD/IN/00001')).body.items[0].status).toBe('done')
  })
})
