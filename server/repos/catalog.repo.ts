import type { Category, Id, Location, LocationKind, Product, Uom, Warehouse } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'

/** SQL for master data: categories, products, warehouses, locations. No business rules here. */

const PRODUCT_COLUMNS = `
  p.id, p.sku, p.name, p.category_id AS categoryId, p.uom, p.cost, p.price,
  p.reorder_min AS reorderMin, p.reorder_max AS reorderMax, p.lead_time_days AS leadTimeDays,
  p.supplier, p.archived, p.created_at AS createdAt`

type ProductRow = Omit<Product, 'archived'> & { archived: number }
const toProduct = (r: ProductRow): Product => ({ ...r, archived: r.archived === 1 })

export const LOCATION_COLUMNS = `
  l.id, l.warehouse_id AS warehouseId, l.name, l.kind,
  CASE l.kind
    WHEN 'internal' THEN w.code || '/' || l.name
    WHEN 'vendor' THEN 'Partners/' || l.name
    WHEN 'customer' THEN 'Partners/' || l.name
    ELSE 'Virtual/' || l.name
  END AS fullName`

export interface NewProduct {
  sku: string
  name: string
  categoryId: Id
  uom: Uom
  cost: number
  price: number
  reorderMin: number
  reorderMax: number
  leadTimeDays: number
  supplier: string | null
}

export function createCatalogRepo(db: Db) {
  return {
    insertCategory(name: string): Id {
      return db.run('INSERT INTO categories (name) VALUES (:name)', { name }).id
    },
    listCategories(): Category[] {
      return db.all<Category>('SELECT id, name FROM categories ORDER BY name')
    },

    insertProduct(p: NewProduct, createdAt: string): Id {
      return db.run(
        `INSERT INTO products (sku, name, category_id, uom, cost, price, reorder_min, reorder_max, lead_time_days, supplier, created_at)
         VALUES (:sku, :name, :categoryId, :uom, :cost, :price, :reorderMin, :reorderMax, :leadTimeDays, :supplier, :createdAt)`,
        { ...p, createdAt },
      ).id
    },
    getProduct(id: Id): Product | undefined {
      const r = db.get<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.id = :id`, { id })
      return r && toProduct(r)
    },
    getProductBySku(sku: string): Product | undefined {
      const r = db.get<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.sku = :sku`, { sku })
      return r && toProduct(r)
    },
    listProducts(): Product[] {
      return db.all<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products p ORDER BY p.name`).map(toProduct)
    },

    insertWarehouse(w: Omit<Warehouse, 'id'>): Id {
      return db.run(
        'INSERT INTO warehouses (code, name, city, capacity_units) VALUES (:code, :name, :city, :capacityUnits)',
        w,
      ).id
    },
    listWarehouses(): Warehouse[] {
      return db.all<Warehouse>('SELECT id, code, name, city, capacity_units AS capacityUnits FROM warehouses ORDER BY id')
    },

    insertLocation(l: { warehouseId: Id | null; name: string; kind: LocationKind }): Id {
      return db.run('INSERT INTO locations (warehouse_id, name, kind) VALUES (:warehouseId, :name, :kind)', l).id
    },
    getLocation(id: Id): (Location & { warehouseCode: string | null }) | undefined {
      return db.get(
        `SELECT ${LOCATION_COLUMNS}, w.code AS warehouseCode
         FROM locations l LEFT JOIN warehouses w ON w.id = l.warehouse_id WHERE l.id = :id`,
        { id },
      )
    },
    listLocations(): Location[] {
      return db.all<Location>(
        `SELECT ${LOCATION_COLUMNS} FROM locations l LEFT JOIN warehouses w ON w.id = l.warehouse_id
         ORDER BY l.kind <> 'internal', w.id, l.id`,
      )
    },
    /** The single virtual location of a kind (vendor / customer / adjustment). */
    virtualLocation(kind: Exclude<LocationKind, 'internal'>): Id {
      const r = db.get<{ id: Id }>('SELECT id FROM locations WHERE kind = :kind ORDER BY id LIMIT 1', { kind })
      if (!r) throw new Error(`Missing virtual location: ${kind}`)
      return r.id
    },
  }
}

export type CatalogRepo = ReturnType<typeof createCatalogRepo>
