import type { ReorderSuggestion } from './reorder.ts'
import type { Id, LocationKind, Operation, OperationLine, OperationType, Product, Uom, Warehouse } from './types.ts'

/** Response shapes of the REST API — shared so the web app is typed against the server. */

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

export interface SessionUser {
  id: Id
  name: string
  email: string
  createdAt: string
}

export type StockStatus = 'in_stock' | 'low' | 'out'

export interface ProductSummary extends Product {
  categoryName: string
  onHand: number
  incoming: number
  value: number
  status: StockStatus
  outbound30d: number
  avgDailyDemand: number
  daysOfCover: number | null
  reorder: ReorderSuggestion | null
}

export interface StockAtLocation {
  locationId: Id
  fullName: string
  warehouseId: Id
  warehouseCode: string
  qty: number
}

export interface ProductDetail extends ProductSummary {
  stock: StockAtLocation[]
}

export interface LocationSummary {
  id: Id
  warehouseId: Id | null
  name: string
  fullName: string
  kind: LocationKind
  onHand: number
}

export interface WarehouseSummary extends Warehouse {
  onHand: number
  utilization: number
  locations: LocationSummary[]
}

export interface OperationLineView extends OperationLine {
  sku: string
  productName: string
  uom: Uom
  /** On hand at the document's source location right now (availability column). */
  available: number | null
}

export interface OperationView extends Omit<Operation, 'lines'> {
  sourceLocation: string
  destLocation: string
  warehouseCode: string
  lines: OperationLineView[]
}

export interface MoveRow {
  id: Id
  createdAt: string
  operationId: Id
  reference: string
  type: OperationType
  productId: Id
  sku: string
  productName: string
  uom: Uom
  fromLocation: string
  toLocation: string
  qty: number
  /** +qty into internal stock, −qty out of it, 0 for internal→internal. */
  delta: number
  /** Running on-hand after this move, when the query is scoped to one product. */
  balance: number | null
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
