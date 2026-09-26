import { describe, expect, it } from 'vitest'

import { findShortages, planMoves, quantityAt, requestedByProduct, roundQty } from './stock.ts'

const VENDOR = 1
const CUSTOMER = 2
const ADJ = 3
const SHELF = 10
const RACK = 11
const ctx = { unitCost: () => 5, systemQty: () => 0 }

describe('ledger arithmetic', () => {
  it('derives on-hand as moves in minus moves out', () => {
    const moves = [
      { productId: 7, fromLocationId: VENDOR, toLocationId: SHELF, qty: 100 },
      { productId: 7, fromLocationId: SHELF, toLocationId: RACK, qty: 30 },
      { productId: 7, fromLocationId: SHELF, toLocationId: CUSTOMER, qty: 20 },
      { productId: 8, fromLocationId: VENDOR, toLocationId: SHELF, qty: 999 },
    ]
    expect(quantityAt(moves, 7, SHELF)).toBe(50)
    expect(quantityAt(moves, 7, RACK)).toBe(30)
    expect(quantityAt(moves, 7, VENDOR)).toBe(-100)
  })

  it('rounds away float noise on fractional units (kg, m)', () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3)
  })

  it('sums demand across duplicate lines before checking availability', () => {
    const lines = [
      { productId: 1, qty: 6 },
      { productId: 1, qty: 6 },
    ]
    expect(requestedByProduct(lines).get(1)).toBe(12)
    expect(findShortages(lines, () => 10)).toEqual([{ productId: 1, requested: 12, available: 10 }])
    expect(findShortages(lines, () => 12)).toEqual([])
  })
})

describe('planMoves — double entry per document type', () => {
  it('receipt: vendor → shelf', () => {
    const { moves } = planMoves({ type: 'receipt', sourceLocationId: VENDOR, destLocationId: SHELF, lines: [{ productId: 1, qty: 50 }] }, ctx)
    expect(moves).toEqual([{ productId: 1, fromLocationId: VENDOR, toLocationId: SHELF, qty: 50, unitCost: 5 }])
  })

  it('delivery: shelf → customer, one move per product', () => {
    const { moves } = planMoves(
      { type: 'delivery', sourceLocationId: SHELF, destLocationId: CUSTOMER, lines: [{ productId: 1, qty: 4 }, { productId: 1, qty: 6 }] },
      ctx,
    )
    expect(moves).toHaveLength(1)
    expect(moves[0]).toMatchObject({ fromLocationId: SHELF, toLocationId: CUSTOMER, qty: 10 })
  })

  it('adjustment down: shelf → virtual adjustment for the difference only', () => {
    const { moves, adjustments } = planMoves(
      { type: 'adjustment', sourceLocationId: ADJ, destLocationId: SHELF, lines: [{ productId: 1, qty: 47 }] },
      { ...ctx, systemQty: () => 50 },
    )
    expect(moves).toEqual([{ productId: 1, fromLocationId: SHELF, toLocationId: ADJ, qty: 3, unitCost: 5 }])
    expect(adjustments).toEqual([{ productId: 1, systemQty: 50, countedQty: 47 }])
  })

  it('adjustment up: virtual adjustment → shelf', () => {
    const { moves } = planMoves(
      { type: 'adjustment', sourceLocationId: ADJ, destLocationId: SHELF, lines: [{ productId: 1, qty: 52 }] },
      { ...ctx, systemQty: () => 50 },
    )
    expect(moves[0]).toMatchObject({ fromLocationId: ADJ, toLocationId: SHELF, qty: 2 })
  })

  it('a count that matches the record posts no move but is still audited', () => {
    const { moves, adjustments } = planMoves(
      { type: 'adjustment', sourceLocationId: ADJ, destLocationId: SHELF, lines: [{ productId: 1, qty: 50 }] },
      { ...ctx, systemQty: () => 50 },
    )
    expect(moves).toEqual([])
    expect(adjustments).toHaveLength(1)
  })
})
