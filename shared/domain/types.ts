/**
 * Core inventory domain — shared by the API (source of truth) and the web app (display).
 * Stock quantities are never stored on products: they are derived from StockMove rows.
 */

export const OPERATION_TYPES = ['receipt', 'delivery', 'transfer', 'adjustment'] as const
export type OperationType = (typeof OPERATION_TYPES)[number]

/** Odoo lifecycle. "canceled" spelling follows the problem statement. */
export const OPERATION_STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'] as const
export type OperationStatus = (typeof OPERATION_STATUSES)[number]

export const UOMS = ['unit', 'kg', 'm', 'L', 'box'] as const
export type Uom = (typeof UOMS)[number]

/**
 * internal   — real shelves/floors inside a warehouse (count toward on-hand)
 * vendor     — Partners/Vendors: source of receipts
 * customer   — Partners/Customers: destination of deliveries
 * adjustment — Virtual/Inventory adjustment: counter-party for count corrections
 */
export const LOCATION_KINDS = ['internal', 'vendor', 'customer', 'adjustment'] as const
export type LocationKind = (typeof LOCATION_KINDS)[number]

export const ADJUSTMENT_REASONS = ['Cycle count', 'Damaged', 'Expired', 'Lost', 'Found', 'Initial stock'] as const
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]

export type Id = number

export interface Category {
  id: Id
  name: string
}

export interface Product {
  id: Id
  sku: string
  name: string
  categoryId: Id
  uom: Uom
  cost: number
  price: number
  /** Reordering rule (Odoo min/max): reorder when forecast ≤ min, refill up to max. */
  reorderMin: number
  reorderMax: number
  leadTimeDays: number
  supplier: string | null
  archived: boolean
  createdAt: string
}

export interface Warehouse {
  id: Id
  code: string
  name: string
  city: string
  capacityUnits: number
}

export interface Location {
  id: Id
  warehouseId: Id | null
  name: string
  /** e.g. "HYD/Rack A" or "Partners/Vendors" */
  fullName: string
  kind: LocationKind
}

export interface OperationLine {
  id: Id
  productId: Id
  /** Demand for receipts/deliveries/transfers; the *counted* quantity for adjustments. */
  qty: number
  picked: boolean
  /** Adjustments only: recorded quantity snapshotted at validation (audit: recorded vs counted). */
  systemQty: number | null
}

export interface Operation {
  id: Id
  reference: string
  type: OperationType
  status: OperationStatus
  partner: string | null
  sourceLocationId: Id
  destLocationId: Id
  scheduledDate: string
  packedAt: string | null
  reason: string | null
  note: string | null
  createdAt: string
  doneAt: string | null
  lines: OperationLine[]
}

export interface StockMove {
  id: Id
  operationId: Id
  productId: Id
  fromLocationId: Id
  toLocationId: Id
  qty: number
  unitCost: number
  createdAt: string
}

/** A move the domain has decided to post, before it gets an id. */
export type PlannedMove = Omit<StockMove, 'id' | 'operationId' | 'createdAt'>
