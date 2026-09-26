import { beforeEach, describe, expect, it } from 'vitest'

import { DomainError } from '@domain/errors.ts'
import { createContext, type AppContext } from '../context.ts'

/** Minimal world: one warehouse (HYD) with Stock + Rack A, one product in kg. */
function setup() {
  const ctx = createContext({ now: () => new Date('2026-09-26T05:00:00Z') })
  const { catalog } = ctx
  catalog.insertLocation({ warehouseId: null, name: 'Vendors', kind: 'vendor' })
  catalog.insertLocation({ warehouseId: null, name: 'Customers', kind: 'customer' })
  catalog.insertLocation({ warehouseId: null, name: 'Inventory adjustment', kind: 'adjustment' })
  const wh = catalog.insertWarehouse({ code: 'HYD', name: 'Hyderabad Main', city: 'Hyderabad', capacityUnits: 1000 })
  const shelf = catalog.insertLocation({ warehouseId: wh, name: 'Stock', kind: 'internal' })
  const rack = catalog.insertLocation({ warehouseId: wh, name: 'Rack A', kind: 'internal' })
  const cat = catalog.insertCategory('Raw Materials')
  const steel = catalog.insertProduct(
    { sku: 'RM-STL', name: 'Steel Rods', categoryId: cat, uom: 'kg', cost: 68, price: 85, reorderMin: 10, reorderMax: 100, leadTimeDays: 5, supplier: 'Tata Steel' },
    '2026-09-01T00:00:00Z',
  )
  return { ctx, shelf, rack, steel }
}

let w: ReturnType<typeof setup>
let ctx: AppContext
beforeEach(() => {
  w = setup()
  ctx = w.ctx
})

const receive = (qty: number) => {
  const op = ctx.ops.create({ type: 'receipt', partner: 'Tata Steel', destLocationId: w.shelf, lines: [{ productId: w.steel, qty }] })
  return ctx.ops.validate(op.id)
}

describe('the spec’s worked example, end to end', () => {
  it('receive 100 kg → move to rack → deliver 20 → 3 kg damaged; all logged, all reconciled', () => {
    // Step 1: receive 100 kg of steel
    const r = receive(100)
    expect(r.status).toBe('done')
    expect(r.reference).toBe('HYD/IN/00001')
    expect(ctx.stock.qtyAt(w.steel, w.shelf)).toBe(100)

    // Step 2: internal transfer — total unchanged, location updated
    const t = ctx.ops.create({ type: 'transfer', sourceLocationId: w.shelf, destLocationId: w.rack, lines: [{ productId: w.steel, qty: 100 }] })
    ctx.ops.validate(t.id)
    expect(ctx.stock.qtyAt(w.steel, w.shelf)).toBe(0)
    expect(ctx.stock.qtyAt(w.steel, w.rack)).toBe(100)
    expect(ctx.stock.onHandByProduct().get(w.steel)).toBe(100)

    // Step 3: deliver 20 (confirm → pick → pack → validate)
    const d = ctx.ops.create({ type: 'delivery', partner: 'L&T', sourceLocationId: w.rack, lines: [{ productId: w.steel, qty: 20 }] })
    expect(ctx.ops.confirm(d.id).status).toBe('ready')
    ctx.ops.pick(d.id)
    ctx.ops.pack(d.id)
    ctx.ops.validate(d.id)
    expect(ctx.stock.qtyAt(w.steel, w.rack)).toBe(80)

    // Step 4: 3 kg damaged — counted 77 against a record of 80
    const a = ctx.ops.create({ type: 'adjustment', destLocationId: w.rack, reason: 'Damaged', lines: [{ productId: w.steel, qty: 77 }] })
    const done = ctx.ops.validate(a.id)
    expect(done.lines[0].systemQty).toBe(80)
    expect(ctx.stock.onHandByProduct().get(w.steel)).toBe(77)

    // Everything logged: 4 documents → 4 ledger moves; double entry holds.
    expect(ctx.stock.countMoves()).toBe(4)
    expect(ctx.stock.conservationCheck()).toEqual([])
  })
})

describe('availability and atomicity', () => {
  it('blocks an over-delivery with a human message and posts nothing', () => {
    receive(12)
    const d = ctx.ops.create({ type: 'delivery', partner: 'Tata Projects', sourceLocationId: w.shelf, lines: [{ productId: w.steel, qty: 40 }] })
    expect(ctx.ops.confirm(d.id).status).toBe('waiting')
    const before = ctx.stock.countMoves()
    try {
      ctx.ops.validate(d.id)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError)
      expect((e as DomainError).code).toBe('INSUFFICIENT_STOCK')
      expect((e as DomainError).message).toBe('Only 12 kg of Steel Rods on hand at HYD/Stock — 40 kg requested.')
    }
    expect(ctx.stock.countMoves()).toBe(before)
    expect(ctx.ops.get(d.id).status).toBe('waiting')
  })

  it('a waiting delivery becomes ready once stock arrives', () => {
    const d = ctx.ops.create({ type: 'delivery', partner: 'X', sourceLocationId: w.shelf, lines: [{ productId: w.steel, qty: 5 }] })
    expect(ctx.ops.confirm(d.id).status).toBe('waiting')
    receive(10)
    expect(ctx.ops.checkAvailability(d.id).operation.status).toBe('ready')
  })

  it('a delivery cannot ship before it is picked and packed', () => {
    receive(10)
    const d = ctx.ops.create({ type: 'delivery', partner: 'X', sourceLocationId: w.shelf, lines: [{ productId: w.steel, qty: 5 }] })
    ctx.ops.confirm(d.id)
    expect(() => ctx.ops.validate(d.id)).toThrowError(/not picked/)
    ctx.ops.pick(d.id)
    expect(() => ctx.ops.validate(d.id)).toThrowError(/not packed/)
    expect(() => ctx.ops.pack(d.id)).not.toThrow()
    expect(ctx.ops.validate(d.id).status).toBe('done')
  })
})

describe('ledger integrity', () => {
  it('done documents cannot be canceled or edited', () => {
    const r = receive(5)
    expect(() => ctx.ops.cancel(r.id)).toThrowError(/already done/)
    expect(() => ctx.ops.update(r.id, { note: 'x' })).toThrowError(/already done/)
  })

  it('the database itself refuses to rewrite or delete ledger rows', () => {
    receive(5)
    expect(() => ctx.db.run('UPDATE stock_moves SET qty = 999')).toThrowError(/append-only/)
    expect(() => ctx.db.run('DELETE FROM stock_moves')).toThrowError(/append-only/)
    expect(() => ctx.db.run("UPDATE operations SET status = 'draft' WHERE status = 'done'")).toThrowError(/immutable/)
  })

  it('references are sequential per warehouse and type', () => {
    receive(1)
    receive(1)
    const t = ctx.ops.create({ type: 'transfer', sourceLocationId: w.shelf, destLocationId: w.rack, lines: [{ productId: w.steel, qty: 1 }] })
    expect(ctx.operations.list({ type: 'receipt' }).map((o) => o.reference).sort()).toEqual(['HYD/IN/00001', 'HYD/IN/00002'])
    expect(t.reference).toBe('HYD/INT/00001')
  })

  it('initial stock is an audited adjustment, not a silent number', () => {
    const op = ctx.ops.postInitialStock(w.steel, w.shelf, 250)
    expect(op).toMatchObject({ type: 'adjustment', status: 'done', reason: 'Initial stock' })
    expect(ctx.stock.qtyAt(w.steel, w.shelf)).toBe(250)
  })

  it('rejects documents that make no sense', () => {
    expect(() => ctx.ops.create({ type: 'transfer', sourceLocationId: w.shelf, destLocationId: w.shelf, lines: [] })).toThrowError(
      /must be different/,
    )
    const empty = ctx.ops.create({ type: 'receipt', destLocationId: w.shelf, lines: [] })
    expect(() => ctx.ops.validate(empty.id)).toThrowError(/no product lines/)
    const recount = ctx.ops.create({
      type: 'adjustment',
      destLocationId: w.shelf,
      lines: [
        { productId: w.steel, qty: 5 },
        { productId: w.steel, qty: 6 },
      ],
    })
    expect(() => ctx.ops.validate(recount.id)).toThrowError(/only once in a count/)
  })
})
