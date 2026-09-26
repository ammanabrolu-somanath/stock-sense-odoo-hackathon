import type { ProductSummary, WarehouseSummary } from '@domain/api.ts'
import { computeHealthScore, type HealthScore } from '@domain/health-score.ts'
import type { Id, OperationType } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'
import type { CatalogRepo } from '../repos/catalog.repo.ts'
import type { OperationsRepo } from '../repos/operations.repo.ts'
import { stockStatus, type InventoryService } from './inventory.service.ts'
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
export interface SeriesPoint {
  date: string
  /** Value received into warehouse locations that day (qty × unit cost, ₹). */
  inbound: number
  /** Value delivered to customers that day. */
  outbound: number
}

export interface ActivityItem {
  id: Id
  reference: string
  type: OperationType
  partner: string | null
  doneAt: string
  lines: number
}

export interface DashboardInsights {
  health: HealthScore
  alerts: { total: number; items: ProductSummary[] }
  series: SeriesPoint[]
  utilization: WarehouseSummary[]
  activity: ActivityItem[]
}

const DAY_MS = 86_400_000

export function createDashboardService(deps: {
  db: Db
  catalog: CatalogRepo
  operations: OperationsRepo
  inventory: InventoryService
  now: Clock
}) {
  const { db, catalog, operations, inventory, now } = deps

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

  /** Value in/out of real shelves per day for the last 30 days (UTC days), zero-filled. */
  function series(f: DashboardFilter): SeriesPoint[] {
    const end = now()
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - 29 * DAY_MS)
    const rows = db.all<{ day: string; inbound: number; outbound: number }>(
      `SELECT substr(m.created_at, 1, 10) AS day,
              ROUND(SUM(CASE WHEN lf.kind = 'vendor' AND lt.kind = 'internal' THEN m.qty * m.unit_cost ELSE 0 END)) AS inbound,
              ROUND(SUM(CASE WHEN lf.kind = 'internal' AND lt.kind = 'customer' THEN m.qty * m.unit_cost ELSE 0 END)) AS outbound
       FROM stock_moves m
       JOIN locations lf ON lf.id = m.from_location_id
       JOIN locations lt ON lt.id = m.to_location_id
       JOIN products p ON p.id = m.product_id
       WHERE m.created_at >= :start
         AND (:warehouseId IS NULL OR lf.warehouse_id = :warehouseId OR lt.warehouse_id = :warehouseId)
         AND (:locationId IS NULL OR lf.id = :locationId OR lt.id = :locationId)
         AND (:categoryId IS NULL OR p.category_id = :categoryId)
       GROUP BY day`,
      { start: start.toISOString(), warehouseId: f.warehouseId ?? null, locationId: f.locationId ?? null, categoryId: f.categoryId ?? null },
    )
    const byDay = new Map(rows.map((r) => [r.day, r]))
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10)
      const r = byDay.get(date)
      return { date, inbound: r?.inbound ?? 0, outbound: r?.outbound ?? 0 }
    })
  }

  return {
    /** Health score, low-stock alerts with reorder suggestions, 30-day flow, utilization, activity. */
    insights(f: DashboardFilter = {}): DashboardInsights {
      const scope = { warehouseId: f.warehouseId, locationId: f.locationId, categoryId: f.categoryId }
      const products = inventory.listProducts(scope)
      const open = operations
        .list({ warehouseId: f.warehouseId, locationId: f.locationId, categoryId: f.categoryId })
        .filter((o) => o.status === 'draft' || o.status === 'waiting' || o.status === 'ready')
      const health = computeHealthScore(
        products.map((p) => ({ onHand: p.onHand, reorderMin: p.reorderMin, outbound30d: p.outbound30d })),
        open,
        now(),
      )
      // Out of stock first, then least days of cover.
      const alerts = products
        .filter((p) => p.status !== 'in_stock')
        .sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1) || (a.daysOfCover ?? 1e9) - (b.daysOfCover ?? 1e9))
      const activity = operations
        .list({ warehouseId: f.warehouseId, locationId: f.locationId, categoryId: f.categoryId, status: 'done' })
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
        .slice(0, 8)
        .map((o) => ({ id: o.id, reference: o.reference, type: o.type, partner: o.partner, doneAt: o.doneAt!, lines: o.lines.length }))
      const utilization = inventory.listWarehouses().filter((w) => !f.warehouseId || w.id === f.warehouseId)
      return { health, alerts: { total: alerts.length, items: alerts.slice(0, 8) }, series: series(f), utilization, activity }
    },

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
