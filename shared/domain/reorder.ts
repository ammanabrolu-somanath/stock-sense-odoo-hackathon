import { roundQty } from './stock.ts'

export interface ReorderInput {
  onHand: number
  /** Quantity on receipts not yet done or canceled. */
  incoming: number
  /** Units delivered to customers over the last 30 days. */
  outbound30d: number
  reorderMin: number
  reorderMax: number
  leadTimeDays: number
}

export interface ReorderSuggestion {
  suggestedQty: number
  /** Days the current on-hand lasts at the 30-day average rate; null when there is no demand. */
  daysOfCover: number | null
  avgDailyDemand: number
  reason: string
}

const SAFETY_DAYS = 7

export function avgDailyDemand(outbound30d: number): number {
  return roundQty(outbound30d / 30)
}

export function daysOfCover(onHand: number, avgDaily: number): number | null {
  if (avgDaily <= 0) return null
  return Math.max(0, Math.floor(onHand / avgDaily))
}

/**
 * Odoo min/max rule with a demand-aware floor:
 *   trigger when forecast (on hand + incoming) ≤ min
 *   refill to max — but never less than what lead time + safety days of demand will consume.
 * Returns null when no reorder is needed.
 */
export function suggestReorder(input: ReorderInput): ReorderSuggestion | null {
  const forecast = roundQty(input.onHand + input.incoming)
  const avgDaily = avgDailyDemand(input.outbound30d)
  const cover = daysOfCover(input.onHand, avgDaily)
  if (forecast > input.reorderMin) return null

  const toMax = input.reorderMax - forecast
  const demandFloor = Math.ceil(avgDaily * (input.leadTimeDays + SAFETY_DAYS)) - forecast
  const suggestedQty = Math.max(Math.ceil(toMax), demandFloor, 1)

  const reason =
    demandFloor > toMax
      ? `Demand of ${avgDaily}/day over ${input.leadTimeDays}d lead time + ${SAFETY_DAYS}d safety exceeds the max level.`
      : `Forecast ${forecast} is at or below the minimum of ${input.reorderMin}; refill to ${input.reorderMax}.`

  return { suggestedQty, daysOfCover: cover, avgDailyDemand: avgDaily, reason }
}
