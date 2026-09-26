/**
 * Inventory Health Score (0–100) — explainable by construction: four weighted factors,
 * each a share in [0, 1], each with the plain-language detail the UI shows.
 */

export interface HealthProductInput {
  onHand: number
  reorderMin: number
  outbound30d: number
}

export interface HealthOperationInput {
  /** ISO date the operation is scheduled for. */
  scheduledDate: string
}

export type HealthFactorKey = 'availability' | 'stockouts' | 'deadStock' | 'backlog'

export interface HealthFactor {
  key: HealthFactorKey
  label: string
  weight: number
  /** Share in [0, 1]; 1 is perfect. */
  value: number
  points: number
  detail: string
}

export type HealthGrade = 'Excellent' | 'Good' | 'Fair' | 'Critical'

export interface HealthScore {
  score: number
  grade: HealthGrade
  factors: HealthFactor[]
}

export const HEALTH_WEIGHTS: Record<HealthFactorKey, number> = {
  availability: 35,
  stockouts: 25,
  deadStock: 20,
  backlog: 20,
}

export function gradeFor(score: number): HealthGrade {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Fair'
  return 'Critical'
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function computeHealthScore(
  products: HealthProductInput[],
  pendingOperations: HealthOperationInput[],
  now: Date,
): HealthScore {
  const total = products.length
  // An empty set is healthy: all-good shares default to 1, all-bad shares to 0.
  const goodShare = (n: number, of: number) => (of === 0 ? 1 : n / of)
  const badShare = (n: number, of: number) => (of === 0 ? 0 : n / of)

  const aboveMin = products.filter((p) => p.onHand > p.reorderMin).length
  const stockedOut = products.filter((p) => p.onHand <= 0).length
  const stocked = products.filter((p) => p.onHand > 0)
  const dead = stocked.filter((p) => p.outbound30d === 0).length
  const today = now.toISOString().slice(0, 10)
  const overdue = pendingOperations.filter((o) => o.scheduledDate.slice(0, 10) < today).length

  const raw: Omit<HealthFactor, 'points'>[] = [
    {
      key: 'availability',
      label: 'Stock availability',
      weight: HEALTH_WEIGHTS.availability,
      value: goodShare(aboveMin, total),
      detail: `${aboveMin} of ${total} products are above their reorder minimum.`,
    },
    {
      key: 'stockouts',
      label: 'Stockouts',
      weight: HEALTH_WEIGHTS.stockouts,
      value: 1 - badShare(stockedOut, total),
      detail: stockedOut === 0 ? 'No product is out of stock.' : `${plural(stockedOut, 'product')} out of stock.`,
    },
    {
      key: 'deadStock',
      label: 'Dead stock',
      weight: HEALTH_WEIGHTS.deadStock,
      value: 1 - badShare(dead, stocked.length),
      detail: dead === 0 ? 'Every stocked product moved in the last 30 days.' : `${plural(dead, 'product')} held with no outbound movement in 30 days.`,
    },
    {
      key: 'backlog',
      label: 'Operational backlog',
      weight: HEALTH_WEIGHTS.backlog,
      value: 1 - badShare(overdue, pendingOperations.length),
      detail:
        overdue === 0
          ? 'No pending operation is past its scheduled date.'
          : `${plural(overdue, 'operation')} past scheduled date, of ${pendingOperations.length} pending.`,
    },
  ]

  const factors = raw.map((f) => ({ ...f, points: Math.round(f.weight * f.value * 10) / 10 }))
  const score = Math.round(factors.reduce((s, f) => s + f.weight * f.value, 0))
  return { score, grade: gradeFor(score), factors }
}
