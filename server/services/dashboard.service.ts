import type { Id, OperationType } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'
import type { CatalogRepo } from '../repos/catalog.repo.ts'
import type { OperationsRepo } from '../repos/operations.repo.ts'
import { stockStatus } from './inventory.service.ts'
import type { Clock } from './operations.service.ts'

export interface DashboardFilter {
  warehouseId?: Id
  locationId?: Id
  categoryId?: Id
}

export interface PendingKpi {
  pending: number
  overdue: number
  waiting: number
}

export interface DashboardKpis {
  scope: { warehouseId: Id | null; locationId: Id | null; categoryId: Id | null }
  productsInStock: number
  totalProducts: number
  stockValue: number
  lowStock: number
  outOfStock: number
  pendingReceipts: PendingKpi
  pendingDeliveries: PendingKpi
  transfersScheduled: PendingKpi
}

/**
 * The spec's dashboard KPIs, computed from the same ledger-derived numbers the lists use
 * (so a KPI always equals the size of the list it links to). Scope: warehouse or location,
 * and product category.
 */
export function createDashboardService(deps: { db: Db; catalog: CatalogRepo; operations: OperationsRepo; now: Clock }) {
  const { db, catalog, operations, now } = deps

  function onHandInScope(f: DashboardFilter): Map<Id, number> {
    const rows = db.all<{ productId: Id; qty: number }>(
      `SELECT product_id AS productId, ROUND(SUM(qty), 3) AS qty FROM internal_quants
       WHERE (:warehouseId IS NULL OR warehouse_id = :warehouseId) AND (:locationId IS NULL OR location_id = :locationId)
       GROUP BY product_id`,
      { warehouseId: f.warehouseId ?? null, locationId: f.locationId ?? null },
    )
    return new Map(rows.map((r) => [r.productId, r.qty]))
  }

  function pending(type: OperationType, f: DashboardFilter): PendingKpi {
    const today = now().toISOString().slice(0, 10)
    const open = operations
      .list({ type, warehouseId: f.warehouseId, locationId: f.locationId, categoryId: f.categoryId })
      .filter((o) => o.status === 'draft' || o.status === 'waiting' || o.status === 'ready')
    return {
      pending: open.length,
      overdue: open.filter((o) => o.scheduledDate.slice(0, 10) < today).length,
      waiting: open.filter((o) => o.status === 'waiting').length,
    }
  }

  return {
    kpis(f: DashboardFilter = {}): DashboardKpis {
      const products = catalog.listProducts().filter((p) => !p.archived && (!f.categoryId || p.categoryId === f.categoryId))
      const onHand = onHandInScope(f)
      let productsInStock = 0
      let lowStock = 0
      let outOfStock = 0
      let stockValue = 0
      for (const p of products) {
        const qty = onHand.get(p.id) ?? 0
        const status = stockStatus(qty, p.reorderMin)
        if (qty > 0) productsInStock++
        if (status === 'low') lowStock++
        if (status === 'out') outOfStock++
        stockValue += Math.max(0, qty) * p.cost
      }
      return {
        scope: { warehouseId: f.warehouseId ?? null, locationId: f.locationId ?? null, categoryId: f.categoryId ?? null },
        productsInStock,
        totalProducts: products.length,
        stockValue: Math.round(stockValue),
        lowStock,
        outOfStock,
        pendingReceipts: pending('receipt', f),
        pendingDeliveries: pending('delivery', f),
        transfersScheduled: pending('transfer', f),
      }
    },
  }
}

export type DashboardService = ReturnType<typeof createDashboardService>
