import { beforeAll, describe, expect, it } from 'vitest'

import { createContext, type AppContext } from '../context.ts'
import { seedDemo } from './seed.ts'
import { PRODUCTS } from './seed-data.ts'

const NOW = new Date('2026-09-26T06:30:00Z')
let ctx: AppContext
let summary: ReturnType<typeof seedDemo>

beforeAll(() => {
  ctx = createContext({ now: () => NOW })
  summary = seedDemo(ctx, { now: NOW })
}, 60_000)

describe('demo seed', () => {
  it('generates a substantial, realistic history', () => {
    expect(summary.operations).toBeGreaterThan(300)
    expect(summary.moves).toBeGreaterThan(500)
    expect(ctx.catalog.listProducts()).toHaveLength(PRODUCTS.length)
    expect(ctx.catalog.listWarehouses().map((w) => w.code)).toEqual(['HYD', 'BLR', 'BOM'])
  })

  it('reconciles: double entry holds for every product', () => {
    expect(ctx.stock.conservationCheck()).toEqual([])
  })

  it('never drives a shelf negative', () => {
    expect(ctx.stock.quants().filter((q) => q.qty < 0)).toEqual([])
  })

  it('has nothing in the future', () => {
    const latest = ctx.db.get<{ at: string }>('SELECT MAX(created_at) AS at FROM stock_moves')!.at
    expect(latest <= NOW.toISOString()).toBe(true)
  })

  it('ends with the story state: low and out-of-stock products, open work in every status', () => {
    const onHand = ctx.stock.onHandByProduct()
    const bySku = new Map(ctx.catalog.listProducts().map((p) => [p.sku, p]))
    for (const p of PRODUCTS.filter((x) => x.profile === 'out')) expect(onHand.get(bySku.get(p.sku)!.id) ?? 0).toBe(0)
    for (const p of PRODUCTS.filter((x) => x.profile === 'low')) {
      const q = onHand.get(bySku.get(p.sku)!.id) ?? 0
      expect(q).toBeGreaterThan(0)
      expect(q).toBeLessThanOrEqual(p.min)
    }
    const statuses = new Set(ctx.operations.list().map((o) => o.status))
    for (const s of ['draft', 'waiting', 'ready', 'done'] as const) expect(statuses).toContain(s)
  })

  it('is deterministic', () => {
    const again = createContext({ now: () => NOW })
    expect(seedDemo(again, { now: NOW })).toEqual(summary)
  }, 60_000)
})
