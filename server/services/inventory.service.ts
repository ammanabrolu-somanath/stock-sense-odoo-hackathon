import type {
  LocationSummary,
  MoveRow,
  OperationView,
  Page,
  ProductDetail,
  ProductSummary,
  StockStatus,
  WarehouseSummary,
} from '@domain/api.ts'
import { DomainError } from '@domain/errors.ts'
import { avgDailyDemand, daysOfCover, suggestReorder } from '@domain/reorder.ts'
import type { MoveQuery, ProductInput } from '@domain/schemas.ts'
import type { Id, Operation, Warehouse } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'
import type { CatalogRepo, NewProduct } from '../repos/catalog.repo.ts'
import type { OperationsRepo } from '../repos/operations.repo.ts'
import type { StockRepo } from '../repos/stock.repo.ts'
import type { Clock, OperationsService } from './operations.service.ts'

const DAY_MS = 86_400_000

export function stockStatus(onHand: number, reorderMin: number): StockStatus {
  if (onHand <= 0) return 'out'
  if (onHand <= reorderMin) return 'low'
  return 'in_stock'
}

/**
 * Read models (products with stock, warehouses with utilization, the move ledger) and
 * master-data commands. Quantities are always computed from the ledger in bulk — never N+1.
 */
export function createInventoryService(deps: {
  db: Db
  catalog: CatalogRepo
  operations: OperationsRepo
  stock: StockRepo
  ops: OperationsService
  now: Clock
}) {
  const { db, catalog, operations, stock, ops, now } = deps

  function outbound30d(): Map<Id, number> {
    const since = new Date(now().getTime() - 30 * DAY_MS).toISOString()
    const rows = db.all<{ productId: Id; qty: number }>(
      `SELECT m.product_id AS productId, ROUND(SUM(m.qty), 3) AS qty
       FROM stock_moves m JOIN locations l ON l.id = m.to_location_id AND l.kind = 'customer'
       WHERE m.created_at >= :since GROUP BY m.product_id`,
      { since },
    )
    return new Map(rows.map((r) => [r.productId, r.qty]))
  }

  function onHandFor(warehouseId?: Id): Map<Id, number> {
    if (!warehouseId) return stock.onHandByProduct()
    const rows = db.all<{ productId: Id; qty: number }>(
      `SELECT product_id AS productId, ROUND(SUM(qty), 3) AS qty FROM internal_quants
       WHERE warehouse_id = :warehouseId GROUP BY product_id`,
      { warehouseId },
    )
    return new Map(rows.map((r) => [r.productId, r.qty]))
  }

  function summaries(
    filter: { q?: string; categoryId?: Id; warehouseId?: Id; status?: StockStatus; includeArchived?: boolean } = {},
  ): ProductSummary[] {
    const categories = new Map(catalog.listCategories().map((c) => [c.id, c.name]))
    const onHand = onHandFor(filter.warehouseId)
    const incoming = operations.incomingByProduct()
    const out30 = outbound30d()
    const q = filter.q?.toLowerCase()

    return catalog
      .listProducts()
      .filter((p) => filter.includeArchived || !p.archived)
      .filter((p) => !filter.categoryId || p.categoryId === filter.categoryId)
      .filter((p) => !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .map((p) => {
        const qty = onHand.get(p.id) ?? 0
        const inc = incoming.get(p.id) ?? 0
        const o30 = out30.get(p.id) ?? 0
        const avg = avgDailyDemand(o30)
        return {
          ...p,
          categoryName: categories.get(p.categoryId) ?? '—',
          onHand: qty,
          incoming: inc,
          value: Math.round(qty * p.cost * 100) / 100,
          status: stockStatus(qty, p.reorderMin),
          outbound30d: o30,
          avgDailyDemand: avg,
          daysOfCover: daysOfCover(qty, avg),
          reorder: suggestReorder({
            onHand: qty,
            incoming: inc,
            outbound30d: o30,
            reorderMin: p.reorderMin,
            reorderMax: p.reorderMax,
            leadTimeDays: p.leadTimeDays,
          }),
        }
      })
      .filter((p) => !filter.status || p.status === filter.status)
  }

  function locationSummaries(): LocationSummary[] {
    return db.all<LocationSummary>(
      `SELECT ln.id, ln.warehouse_id AS warehouseId, ln.name, ln.full_name AS fullName, ln.kind,
              COALESCE((SELECT ROUND(SUM(q.qty), 3) FROM internal_quants q WHERE q.location_id = ln.id), 0) AS onHand
       FROM location_names ln ORDER BY ln.kind <> 'internal', ln.warehouse_id, ln.id`,
    )
  }

  function enrich(list: Operation[]): OperationView[] {
    const names = new Map(locationSummaries().map((l) => [l.id, l]))
    const products = new Map(catalog.listProducts().map((p) => [p.id, p]))
    return list.map((op) => {
      const src = names.get(op.sourceLocationId)
      const dst = names.get(op.destLocationId)
      const internalSide = src?.kind === 'internal' ? src : dst
      const warehouseCode = internalSide?.fullName.split('/')[0] ?? ''
      const showAvailable = op.status !== 'done' && op.status !== 'canceled' && (op.type === 'delivery' || op.type === 'transfer' || op.type === 'adjustment')
      const availableAt = op.type === 'adjustment' ? op.destLocationId : op.sourceLocationId
      return {
        ...op,
        sourceLocation: src?.fullName ?? '?',
        destLocation: dst?.fullName ?? '?',
        warehouseCode,
        lines: op.lines.map((l) => {
          const p = products.get(l.productId)
          return {
            ...l,
            sku: p?.sku ?? '?',
            productName: p?.name ?? 'Unknown product',
            uom: p?.uom ?? 'unit',
            available: showAvailable ? stock.qtyAt(l.productId, availableAt) : null,
          }
        }),
      }
    })
  }

  function getProduct(id: Id): ProductDetail {
    if (!catalog.getProduct(id)) throw new DomainError('NOT_FOUND', 'This product does not exist.')
    const product = summaries({ includeArchived: true }).find((p) => p.id === id)!
    const stockRows = db.all<ProductDetail['stock'][number]>(
        `SELECT q.location_id AS locationId, ln.full_name AS fullName, q.warehouse_id AS warehouseId,
                ln.warehouse_code AS warehouseCode, q.qty
         FROM internal_quants q JOIN location_names ln ON ln.id = q.location_id
         WHERE q.product_id = :id AND q.qty <> 0 ORDER BY q.warehouse_id, q.location_id`,
        { id },
      )
    return { ...product, stock: stockRows }
  }

  function listWarehouses(): WarehouseSummary[] {
    const locations = locationSummaries()
    return catalog.listWarehouses().map((w) => {
      const own = locations.filter((l) => l.warehouseId === w.id)
      const onHand = Math.round(own.reduce((s, l) => s + l.onHand, 0) * 1000) / 1000
      return { ...w, onHand, utilization: Math.min(1, onHand / w.capacityUnits), locations: own }
    })
  }

  return {
    listProducts: summaries,
    getProduct,

    createProduct(input: ProductInput, userId: Id | null): ProductDetail {
      const id = db.tx(() => {
        if (catalog.getProductBySku(input.sku)) throw new DomainError('CONFLICT', `SKU ${input.sku} already exists.`)
        if (!catalog.listCategories().some((c) => c.id === input.categoryId)) {
          throw new DomainError('VALIDATION', 'Choose an existing category.')
        }
        const { initialStock, ...fields } = input
        const productId = catalog.insertProduct({ ...fields, supplier: fields.supplier ?? null } as NewProduct, now().toISOString())
        if (initialStock) ops.postInitialStock(productId, initialStock.locationId, initialStock.qty, userId)
        return productId
      })
      return getProduct(id)
    },

    updateProduct(id: Id, patch: Partial<NewProduct & { archived: boolean }>): ProductDetail {
      db.tx(() => {
        const current = catalog.getProduct(id)
        if (!current) throw new DomainError('NOT_FOUND', 'This product does not exist.')
        const next = { ...current, ...patch }
        if (next.reorderMax < next.reorderMin) throw new DomainError('VALIDATION', 'Maximum must be at least the minimum.')
        if (patch.sku && patch.sku !== current.sku && catalog.getProductBySku(patch.sku)) {
          throw new DomainError('CONFLICT', `SKU ${patch.sku} already exists.`)
        }
        db.run(
          `UPDATE products SET sku = :sku, name = :name, category_id = :categoryId, uom = :uom, cost = :cost, price = :price,
             reorder_min = :reorderMin, reorder_max = :reorderMax, lead_time_days = :leadTimeDays, supplier = :supplier,
             archived = :archived
           WHERE id = :id`,
          {
            id,
            sku: next.sku,
            name: next.name,
            categoryId: next.categoryId,
            uom: next.uom,
            cost: next.cost,
            price: next.price,
            reorderMin: next.reorderMin,
            reorderMax: next.reorderMax,
            leadTimeDays: next.leadTimeDays,
            supplier: next.supplier ?? null,
            archived: next.archived ? 1 : 0,
          },
        )
      })
      return getProduct(id)
    },

    createCategory(name: string) {
      if (catalog.listCategories().some((c) => c.name.toLowerCase() === name.toLowerCase())) {
        throw new DomainError('CONFLICT', `Category "${name}" already exists.`)
      }
      const id = catalog.insertCategory(name)
      return { id, name }
    },

    listLocations: locationSummaries,

    listWarehouses,

    createWarehouse(input: Omit<Warehouse, 'id'>): WarehouseSummary {
      const id = db.tx(() => {
        if (catalog.listWarehouses().some((w) => w.code.toUpperCase() === input.code.toUpperCase())) {
          throw new DomainError('CONFLICT', `Warehouse code ${input.code} is already in use.`)
        }
        const warehouseId = catalog.insertWarehouse(input)
        catalog.insertLocation({ warehouseId, name: 'Stock', kind: 'internal' })
        return warehouseId
      })
      return listWarehouses().find((w) => w.id === id)!
    },

    updateWarehouse(id: Id, patch: Partial<Omit<Warehouse, 'id' | 'code'>>): WarehouseSummary {
      const current = catalog.listWarehouses().find((w) => w.id === id)
      if (!current) throw new DomainError('NOT_FOUND', 'This warehouse does not exist.')
      db.run('UPDATE warehouses SET name = :name, city = :city, capacity_units = :capacityUnits WHERE id = :id', {
        id,
        name: patch.name ?? current.name,
        city: patch.city ?? current.city,
        capacityUnits: patch.capacityUnits ?? current.capacityUnits,
      })
      return listWarehouses().find((w) => w.id === id)!
    },

    addLocation(warehouseId: Id, name: string): LocationSummary {
      const wh = catalog.listWarehouses().find((w) => w.id === warehouseId)
      if (!wh) throw new DomainError('NOT_FOUND', 'This warehouse does not exist.')
      if (locationSummaries().some((l) => l.warehouseId === warehouseId && l.name.toLowerCase() === name.toLowerCase())) {
        throw new DomainError('CONFLICT', `${wh.code}/${name} already exists.`)
      }
      const id = catalog.insertLocation({ warehouseId, name, kind: 'internal' })
      return locationSummaries().find((l) => l.id === id)!
    },

    /** Open work per document type (draft/waiting/ready), with how much is past its date. */
    pendingCounts(): Record<'receipt' | 'delivery' | 'transfer' | 'adjustment', { pending: number; overdue: number }> {
      const today = now().toISOString().slice(0, 10)
      const rows = db.all<{ type: 'receipt' | 'delivery' | 'transfer' | 'adjustment'; pending: number; overdue: number }>(
        `SELECT type, COUNT(*) AS pending, SUM(CASE WHEN substr(scheduled_date, 1, 10) < :today THEN 1 ELSE 0 END) AS overdue
         FROM operations WHERE status IN ('draft','waiting','ready') GROUP BY type`,
        { today },
      )
      const out = {
        receipt: { pending: 0, overdue: 0 },
        delivery: { pending: 0, overdue: 0 },
        transfer: { pending: 0, overdue: 0 },
        adjustment: { pending: 0, overdue: 0 },
      }
      for (const r of rows) out[r.type] = { pending: r.pending, overdue: r.overdue }
      return out
    },

    /** Everything on one shelf, from the ledger — the "available" / "recorded" column in line editors. */
    stockAtLocation(locationId: Id): { productId: Id; qty: number }[] {
      if (!catalog.getLocation(locationId)) throw new DomainError('NOT_FOUND', 'This location does not exist.')
      return db.all(
        'SELECT product_id AS productId, qty FROM stock_quants WHERE location_id = :locationId AND qty <> 0 ORDER BY product_id',
        { locationId },
      )
    },

    enrichOperations: enrich,
    getOperation(id: Id): OperationView {
      return enrich([ops.get(id)])[0]
    },

    /**
     * The ledger. When scoped to one product, each row carries the running on-hand
     * (within the location/warehouse scope) computed by a window over the full history,
     * so pagination and date filters don't break the balance.
     */
    listMoves(f: MoveQuery): Page<MoveRow> {
      const params = {
        productId: f.productId ?? null,
        locationId: f.locationId ?? null,
        warehouseId: f.warehouseId ?? null,
        type: f.type ?? null,
        from: f.from ?? null,
        to: f.to ?? null,
        q: f.q?.trim() || null,
      }
      // Does a location count toward the scope's on-hand?
      const inScope = (alias: string) =>
        `(${alias}.kind = 'internal' AND (:locationId IS NULL OR ${alias}.id = :locationId)
          AND (:warehouseId IS NULL OR ${alias}.warehouse_id = :warehouseId))`
      const base = `
        WITH scoped AS (
          SELECT m.id, m.created_at AS createdAt, m.operation_id AS operationId, o.reference, o.type,
                 m.product_id AS productId, p.sku, p.name AS productName, p.uom,
                 lf.full_name AS fromLocation, lt.full_name AS toLocation, m.qty,
                 (CASE WHEN ${inScope('lt')} THEN m.qty ELSE 0 END) - (CASE WHEN ${inScope('lf')} THEN m.qty ELSE 0 END) AS delta
          FROM stock_moves m
          JOIN operations o ON o.id = m.operation_id
          JOIN products p ON p.id = m.product_id
          JOIN location_names lf ON lf.id = m.from_location_id
          JOIN location_names lt ON lt.id = m.to_location_id
          WHERE (:productId IS NULL OR m.product_id = :productId)
            AND (:locationId IS NULL OR m.from_location_id = :locationId OR m.to_location_id = :locationId)
            AND (:warehouseId IS NULL OR lf.warehouse_id = :warehouseId OR lt.warehouse_id = :warehouseId)
        ),
        balanced AS (
          SELECT *, CASE WHEN :productId IS NULL THEN NULL
                         ELSE ROUND(SUM(delta) OVER (ORDER BY createdAt, id), 3) END AS balance
          FROM scoped
        )
        SELECT * FROM balanced
        WHERE (:type IS NULL OR type = :type)
          AND (:from IS NULL OR createdAt >= :from)
          AND (:to IS NULL OR createdAt < date(:to, '+1 day'))
          AND (:q IS NULL OR reference LIKE '%' || :q || '%' OR sku LIKE '%' || :q || '%' OR productName LIKE '%' || :q || '%')`
      const total = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM (${base})`, params)?.n ?? 0
      const items = db.all<MoveRow>(`${base} ORDER BY createdAt DESC, id DESC LIMIT :limit OFFSET :offset`, {
        ...params,
        limit: f.pageSize,
        offset: (f.page - 1) * f.pageSize,
      })
      return { items, total, page: f.page, pageSize: f.pageSize }
    },
  }
}

export type InventoryService = ReturnType<typeof createInventoryService>
