import type { Id, Operation, OperationLine, PlannedMove, StockMove } from './types.ts'

/** Quantities are REAL (kg, metres); keep them clean of float noise. */
export function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** On-hand at one location = Σ moves in − Σ moves out. The ledger is the only source of truth. */
export function quantityAt(moves: Pick<StockMove, 'productId' | 'fromLocationId' | 'toLocationId' | 'qty'>[], productId: Id, locationId: Id): number {
  let q = 0
  for (const m of moves) {
    if (m.productId !== productId) continue
    if (m.toLocationId === locationId) q += m.qty
    if (m.fromLocationId === locationId) q -= m.qty
  }
  return roundQty(q)
}

/** Total requested per product (a document may list the same product on several lines). */
export function requestedByProduct(lines: Pick<OperationLine, 'productId' | 'qty'>[]): Map<Id, number> {
  const out = new Map<Id, number>()
  for (const l of lines) out.set(l.productId, roundQty((out.get(l.productId) ?? 0) + l.qty))
  return out
}

export interface Shortage {
  productId: Id
  requested: number
  available: number
}

/** Products whose requested quantity exceeds what the source location holds. */
export function findShortages(
  lines: Pick<OperationLine, 'productId' | 'qty'>[],
  availableAt: (productId: Id) => number,
): Shortage[] {
  const shortages: Shortage[] = []
  for (const [productId, requested] of requestedByProduct(lines)) {
    const available = roundQty(availableAt(productId))
    if (requested > available) shortages.push({ productId, requested, available })
  }
  return shortages
}

type PlanInput = Pick<Operation, 'type' | 'sourceLocationId' | 'destLocationId'> & {
  lines: Pick<OperationLine, 'productId' | 'qty'>[]
}

export interface PlannedAdjustment {
  productId: Id
  systemQty: number
  countedQty: number
}

/**
 * Turn a validated document into ledger moves. Every move is double-entry (from → to):
 *   receipt    vendor     → internal
 *   delivery   internal   → customer
 *   transfer   internal   → internal
 *   adjustment internal ↔ virtual adjustment, by the sign of (counted − recorded)
 * For adjustments, `sourceLocationId` is the virtual location and `destLocationId` the counted shelf.
 */
export function planMoves(
  op: PlanInput,
  ctx: { unitCost: (productId: Id) => number; systemQty: (productId: Id) => number },
): { moves: PlannedMove[]; adjustments: PlannedAdjustment[] } {
  if (op.type !== 'adjustment') {
    const moves = [...requestedByProduct(op.lines)].map(([productId, qty]) => ({
      productId,
      fromLocationId: op.sourceLocationId,
      toLocationId: op.destLocationId,
      qty,
      unitCost: ctx.unitCost(productId),
    }))
    return { moves: moves.filter((m) => m.qty > 0), adjustments: [] }
  }

  const moves: PlannedMove[] = []
  const adjustments: PlannedAdjustment[] = []
  // For a count, the last line for a product wins (a recount replaces, it doesn't add).
  const counted = new Map<Id, number>()
  for (const l of op.lines) counted.set(l.productId, roundQty(l.qty))
  for (const [productId, countedQty] of counted) {
    const systemQty = roundQty(ctx.systemQty(productId))
    adjustments.push({ productId, systemQty, countedQty })
    const delta = roundQty(countedQty - systemQty)
    if (delta === 0) continue
    const shelf = op.destLocationId
    const virtual = op.sourceLocationId
    moves.push({
      productId,
      fromLocationId: delta > 0 ? virtual : shelf,
      toLocationId: delta > 0 ? shelf : virtual,
      qty: Math.abs(delta),
      unitCost: ctx.unitCost(productId),
    })
  }
  return { moves, adjustments }
}
