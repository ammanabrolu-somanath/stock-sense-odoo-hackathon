import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { createContext, type AppContext } from './context.ts'
import { bootstrap } from './db/reset.ts'
import { DEMO_USER } from './services/auth.service.ts'

const NOW = new Date('2026-09-26T06:30:00Z')
let ctx: AppContext
let agent: ReturnType<typeof request.agent>

beforeAll(async () => {
  ctx = createContext({ now: () => NOW })
  bootstrap(ctx)
  agent = request.agent(createApp(ctx))
  await agent.post('/api/auth/login').send({ email: DEMO_USER.email, password: DEMO_USER.password })
}, 60_000)

const openCount = async (query: string) =>
  ((await agent.get(`/api/operations?${query}`)).body.items as { status: string }[]).filter((o) =>
    ['draft', 'waiting', 'ready'].includes(o.status),
  ).length

describe('dashboard KPIs equal the lists they link to', () => {
  it('for the whole company', async () => {
    const k = (await agent.get('/api/dashboard')).body
    const products = (await agent.get('/api/products')).body.items as { onHand: number; value: number }[]
    expect(k.totalProducts).toBe(products.length)
    expect(k.productsInStock).toBe(products.filter((p) => p.onHand > 0).length)
    expect(k.productsInStock).toBe((await agent.get('/api/products?status=available')).body.items.length)
    expect(k.lowStock).toBe((await agent.get('/api/products?status=low')).body.items.length)
    expect(k.outOfStock).toBe((await agent.get('/api/products?status=out')).body.items.length)
    expect(k.stockValue).toBe(Math.round(products.reduce((s, p) => s + Math.max(0, p.value), 0)))
    expect(k.pendingReceipts.pending).toBe(await openCount('type=receipt'))
    expect(k.pendingDeliveries.pending).toBe(await openCount('type=delivery'))
    expect(k.transfersScheduled.pending).toBe(await openCount('type=transfer'))
    expect(k.pendingDeliveries.waiting).toBeGreaterThan(0)
    expect(k.lowStock + k.outOfStock).toBeGreaterThan(0)
  })

  it('for one warehouse, one location, and one category', async () => {
    const whs = (await agent.get('/api/warehouses')).body.items as { id: number; code: string; locations: { id: number; name: string }[] }[]
    const bom = whs.find((w) => w.code === 'BOM')!
    const k = (await agent.get(`/api/dashboard?warehouseId=${bom.id}`)).body
    expect(k.scope.warehouseId).toBe(bom.id)
    expect(k.outOfStock).toBe((await agent.get(`/api/products?status=out&warehouseId=${bom.id}`)).body.items.length)
    expect(k.pendingDeliveries.pending).toBe(await openCount(`type=delivery&warehouseId=${bom.id}`))

    const rackA = whs[0].locations.find((l) => l.name === 'Rack A')!
    const atRack = (await agent.get(`/api/dashboard?locationId=${rackA.id}`)).body
    const rackProducts = (await agent.get(`/api/products?locationId=${rackA.id}`)).body.items as { onHand: number }[]
    expect(atRack.productsInStock).toBe(rackProducts.filter((p) => p.onHand > 0).length)

    const cats = (await agent.get('/api/categories')).body.items as { id: number; name: string }[]
    const electronics = cats.find((c) => c.name === 'Electronics')!
    const kc = (await agent.get(`/api/dashboard?categoryId=${electronics.id}`)).body
    expect(kc.totalProducts).toBe((await agent.get(`/api/products?categoryId=${electronics.id}`)).body.items.length)
    expect(kc.totalProducts).toBeLessThan((await agent.get('/api/dashboard')).body.totalProducts)
  })

  it('rejects nonsense filters', async () => {
    expect((await agent.get('/api/dashboard?warehouseId=abc')).status).toBe(400)
  })
})

describe('move history', () => {
  it('pages on the server, filters by type and date, and keeps a running balance per product', async () => {
    const all = (await agent.get('/api/moves?pageSize=20')).body
    expect(all.items).toHaveLength(20)
    expect(all.total).toBeGreaterThan(1000)
    expect(all.items[0].balance).toBeNull()

    const steel = (await agent.get('/api/products?q=RM-STL-012')).body.items[0]
    const scoped = (await agent.get(`/api/moves?productId=${steel.id}&pageSize=200`)).body
    expect(scoped.items[0].balance).toBe(steel.onHand)
    // Walking back, each balance is the next one minus that move's change.
    for (let i = 0; i < scoped.items.length - 1; i++) {
      expect(scoped.items[i + 1].balance).toBeCloseTo(scoped.items[i].balance - scoped.items[i].delta, 3)
    }

    const receipts = (await agent.get('/api/moves?type=receipt&pageSize=200')).body.items as { type: string }[]
    expect(receipts.every((m) => m.type === 'receipt')).toBe(true)
    const day = (await agent.get('/api/moves?from=2026-09-20&to=2026-09-20&pageSize=200')).body.items as { createdAt: string }[]
    expect(day.length).toBeGreaterThan(0)
    expect(day.every((m) => m.createdAt.startsWith('2026-09-20'))).toBe(true)
  })

  it('exports the same filtered rows as CSV', async () => {
    const steel = (await agent.get('/api/products?q=RM-STL-012')).body.items[0]
    const page = (await agent.get(`/api/moves?productId=${steel.id}&pageSize=1`)).body
    const res = await agent.get(`/api/moves.csv?productId=${steel.id}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/csv/)
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="stocksense-moves-2026-09-26\.csv"/)
    const rows = res.text.trim().split('\r\n')
    expect(rows[0]).toBe('Date,Reference,Type,SKU,Product,From,To,Quantity,Unit,Change,Balance')
    expect(rows).toHaveLength(page.total + 1)
    expect(rows[1].endsWith(`,${steel.onHand}`)).toBe(true)
  })

  it('neutralises spreadsheet formulas in exported text', async () => {
    const cats = (await agent.get('/api/categories')).body.items
    const shelf = (await agent.get('/api/locations')).body.items.find((l: { kind: string }) => l.kind === 'internal')
    const created = await agent.post('/api/products').send({
      sku: 'CSV-INJ',
      name: '=HYPERLINK("http://evil.example","x")',
      categoryId: cats[0].id,
      uom: 'unit',
      cost: 1,
      price: 1,
      reorderMin: 0,
      reorderMax: 0,
      leadTimeDays: 1,
      initialStock: { locationId: shelf.id, qty: 1 },
    })
    const csv = (await agent.get(`/api/moves.csv?productId=${created.body.id}`)).text
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`)
  })
})

describe('settings: warehouses and locations', () => {
  it('creates a warehouse with a Stock location, adds locations, edits, and refuses duplicates', async () => {
    const res = await agent.post('/api/warehouses').send({ code: 'del', name: 'Delhi Depot', city: 'New Delhi', capacityUnits: 5000 })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ code: 'DEL', onHand: 0, utilization: 0 })
    expect(res.body.locations.map((l: { fullName: string }) => l.fullName)).toEqual(['DEL/Stock'])

    const rack = await agent.post(`/api/warehouses/${res.body.id}/locations`).send({ name: 'Cold Room' })
    expect(rack.body.fullName).toBe('DEL/Cold Room')
    expect((await agent.post(`/api/warehouses/${res.body.id}/locations`).send({ name: 'cold room' })).status).toBe(409)
    expect((await agent.post('/api/warehouses').send({ code: 'DEL', name: 'Again', city: 'X', capacityUnits: 1 })).status).toBe(409)

    const edited = await agent.patch(`/api/warehouses/${res.body.id}`).send({ capacityUnits: 8000, name: 'Delhi DC' })
    expect(edited.body).toMatchObject({ name: 'Delhi DC', capacityUnits: 8000, code: 'DEL' })
  })

  it('reports utilization from the ledger', async () => {
    const whs = (await agent.get('/api/warehouses')).body.items as { code: string; onHand: number; capacityUnits: number; utilization: number }[]
    const hyd = whs.find((w) => w.code === 'HYD')!
    expect(hyd.onHand).toBeGreaterThan(0)
    expect(hyd.utilization).toBeCloseTo(Math.min(1, hyd.onHand / hyd.capacityUnits), 6)
  })
})

describe('insights: health score, alerts, flow, reorder', () => {
  it('explains the health score with four weighted factors', async () => {
    const { health } = (await agent.get('/api/dashboard/insights')).body
    expect(health.score).toBeGreaterThanOrEqual(0)
    expect(health.score).toBeLessThanOrEqual(100)
    expect(health.factors.map((f: { key: string }) => f.key)).toEqual(['availability', 'stockouts', 'deadStock', 'backlog'])
    expect(health.factors.reduce((s: number, f: { weight: number }) => s + f.weight, 0)).toBe(100)
    expect(health.factors.every((f: { detail: string }) => f.detail.length > 10)).toBe(true)
  })

  it('lists alerts out-of-stock first, each with a reorder suggestion, matching the low+out KPIs', async () => {
    const { alerts } = (await agent.get('/api/dashboard/insights')).body
    const k = (await agent.get('/api/dashboard')).body
    expect(alerts.total).toBe(k.lowStock + k.outOfStock)
    expect(alerts.items[0].status).toBe('out')
    expect(alerts.items.every((p: { status: string }) => p.status !== 'in_stock')).toBe(true)
  })

  it('returns 30 zero-filled days of inbound and outbound value', async () => {
    const { series, activity, utilization } = (await agent.get('/api/dashboard/insights')).body
    expect(series).toHaveLength(30)
    expect(series.at(-1).date).toBe('2026-09-26')
    expect(series.some((d: { outbound: number }) => d.outbound > 0)).toBe(true)
    expect(activity.length).toBeGreaterThan(0)
    expect(utilization.length).toBeGreaterThanOrEqual(3)
  })

  it('one-click reorder creates a draft receipt from the suggestion; receiving it improves the score', async () => {
    const before = (await agent.get('/api/dashboard/insights')).body
    const target = before.alerts.items.find((p: { status: string; reorder: unknown }) => p.status === 'low' && p.reorder)
    const res = await agent.post(`/api/products/${target.id}/reorder`)
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ type: 'receipt', status: 'draft', partner: target.supplier })
    expect(res.body.lines[0]).toMatchObject({ productId: target.id, qty: target.reorder.suggestedQty })
    expect(res.body.destLocation).toMatch(/\/Stock$/)

    await agent.post(`/api/operations/${res.body.id}/validate`)
    const after = (await agent.get('/api/dashboard/insights')).body
    expect(after.alerts.total).toBe(before.alerts.total - 1)
    expect(after.health.score).toBeGreaterThanOrEqual(before.health.score)
    const availability = (h: { factors: { key: string; value: number }[] }) => h.factors.find((f) => f.key === 'availability')!.value
    expect(availability(after.health)).toBeGreaterThan(availability(before.health))
  })
})

describe('analytics', () => {
  it('classifies ABC by consumption value: shares sum to 1, classes ordered A → B → C', async () => {
    const { abc, totals, categories } = (await agent.get('/api/analytics')).body
    const shares = abc.rows.reduce((s: number, r: { share: number }) => s + r.share, 0)
    expect(shares).toBeCloseTo(1, 2)
    const order = abc.rows.map((r: { abc: string }) => r.abc).join('')
    expect(order).toMatch(/^A+B*C*$/)
    expect(abc.summary.A.valueShare).toBeGreaterThanOrEqual(0.8)
    expect(abc.rows.find((r: { sku: string }) => r.sku === 'EL-TAB-10').abc).toBe('C') // dead stock never moves
    expect(totals.daysOfInventory).toBeGreaterThan(0)
    expect(categories.reduce((s: number, c: { stockValue: number }) => s + c.stockValue, 0)).toBe(totals.stockValue)
  })
})
