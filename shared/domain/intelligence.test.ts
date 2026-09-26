import { describe, expect, it } from 'vitest'

import { computeHealthScore, gradeFor } from './health-score.ts'
import { suggestReorder } from './reorder.ts'

describe('smart reorder (min/max + demand)', () => {
  const base = { onHand: 10, incoming: 0, outbound30d: 30, reorderMin: 20, reorderMax: 100, leadTimeDays: 7 }

  it('does nothing while the forecast is above the minimum', () => {
    expect(suggestReorder({ ...base, onHand: 21 })).toBeNull()
  })

  it('counts incoming receipts in the forecast', () => {
    expect(suggestReorder({ ...base, incoming: 15 })).toBeNull()
  })

  it('refills to max when demand is modest', () => {
    const s = suggestReorder(base)!
    expect(s.suggestedQty).toBe(90)
    expect(s.daysOfCover).toBe(10)
  })

  it('orders beyond max when lead-time demand requires it', () => {
    const s = suggestReorder({ ...base, outbound30d: 300 })! // 10/day × (7 + 7) = 140
    expect(s.suggestedQty).toBe(130)
    expect(s.reason).toMatch(/exceeds the max/)
  })
})

describe('inventory health score', () => {
  const now = new Date('2026-09-26T10:00:00Z')
  const healthy = { onHand: 50, reorderMin: 10, outbound30d: 20 }

  it('is 100 for a healthy, moving, on-schedule inventory', () => {
    const h = computeHealthScore([healthy, healthy], [{ scheduledDate: '2026-09-27' }], now)
    expect(h.score).toBe(100)
    expect(h.grade).toBe('Excellent')
  })

  it('explains each deduction', () => {
    const h = computeHealthScore(
      [healthy, { onHand: 0, reorderMin: 10, outbound30d: 5 }, { onHand: 40, reorderMin: 10, outbound30d: 0 }],
      [{ scheduledDate: '2026-09-20' }, { scheduledDate: '2026-09-30' }],
      now,
    )
    const f = Object.fromEntries(h.factors.map((x) => [x.key, x]))
    expect(f.stockouts.detail).toBe('1 product out of stock.')
    expect(f.deadStock.detail).toMatch(/1 product held with no outbound/)
    expect(f.backlog.value).toBe(0.5)
    expect(h.score).toBeGreaterThanOrEqual(0)
    expect(h.score).toBeLessThanOrEqual(100)
    expect(h.score).toBe(Math.round(h.factors.reduce((s, x) => s + x.weight * x.value, 0)))
  })

  it('stays in bounds with no data at all', () => {
    expect(computeHealthScore([], [], now).score).toBe(100)
  })

  it('grades on fixed thresholds', () => {
    expect([gradeFor(85), gradeFor(84), gradeFor(70), gradeFor(50), gradeFor(49)]).toEqual(['Excellent', 'Good', 'Good', 'Fair', 'Critical'])
  })
})
