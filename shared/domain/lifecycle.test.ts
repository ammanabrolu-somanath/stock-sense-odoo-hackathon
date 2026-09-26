import { describe, expect, it } from 'vitest'

import { DomainError } from './errors.ts'
import { assertCan, assertShippable, statusAfterAvailability } from './lifecycle.ts'
import { formatReference } from './references.ts'

const doc = (over: object = {}) => ({ reference: 'HYD/OUT/00001', type: 'delivery' as const, status: 'ready' as const, ...over })

describe('operation lifecycle', () => {
  it('done documents are immutable, and the message says how to correct them', () => {
    const run = () => assertCan('cancel', doc({ status: 'done' }))
    expect(run).toThrowError(DomainError)
    expect(run).toThrowError(/post an adjustment/)
  })

  it('only deliveries are picked and packed', () => {
    expect(() => assertCan('pick', doc({ type: 'receipt' }))).toThrowError(/Only deliveries/)
    expect(() => assertCan('pick', doc())).not.toThrow()
  })

  it('availability decides Ready vs Waiting only for stock-consuming documents', () => {
    expect(statusAfterAvailability('delivery', true)).toBe('waiting')
    expect(statusAfterAvailability('transfer', false)).toBe('ready')
    expect(statusAfterAvailability('receipt', true)).toBe('ready')
  })

  it('a delivery ships only when every line is picked and it is packed', () => {
    const lines = [
      { id: 1, productId: 1, qty: 1, picked: true, systemQty: null },
      { id: 2, productId: 2, qty: 1, picked: false, systemQty: null },
    ]
    expect(() => assertShippable({ ...doc(), packedAt: null, lines })).toThrowError(/1 line not picked/)
    const picked = lines.map((l) => ({ ...l, picked: true }))
    expect(() => assertShippable({ ...doc(), packedAt: null, lines: picked })).toThrowError(/not packed/)
    expect(() => assertShippable({ ...doc(), packedAt: '2026-09-26T10:00:00Z', lines: picked })).not.toThrow()
  })

  it('formats Odoo-style references', () => {
    expect(formatReference('HYD', 'receipt', 42)).toBe('HYD/IN/00042')
    expect(formatReference('BOM', 'adjustment', 7)).toBe('BOM/ADJ/00007')
  })
})
