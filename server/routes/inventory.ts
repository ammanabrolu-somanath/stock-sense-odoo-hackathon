import { Router } from 'express'

import type { MoveRow } from '@domain/api.ts'
import {
  categoryInputSchema,
  dashboardQuerySchema,
  locationInputSchema,
  moveQuerySchema,
  productInputSchema,
  productPatchSchema,
  productQuerySchema,
  warehouseInputSchema,
  warehousePatchSchema,
} from '@domain/schemas.ts'
import type { AppContext } from '../context.ts'
import { currentUser, idParam, parse } from '../http.ts'

const MAX_CSV_ROWS = 20_000

/** RFC 4180 CSV; quantities stay numeric so spreadsheets can sum them. */
function toCsv(rows: MoveRow[]): string {
  const esc = (v: string | number | null) => {
    let s = v === null ? '' : String(v)
    // Text that a spreadsheet would treat as a formula (user-entered names) is neutralised.
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ['Date', 'Reference', 'Type', 'SKU', 'Product', 'From', 'To', 'Quantity', 'Unit', 'Change', 'Balance']
  const lines = rows.map((m) =>
    [m.createdAt, m.reference, m.type, m.sku, m.productName, m.fromLocation, m.toLocation, m.qty, m.uom, m.delta, m.balance].map(esc).join(','),
  )
  return [header.join(','), ...lines].join('\r\n') + '\r\n'
}

/** Products, categories, warehouses, locations, the move ledger and dashboard KPIs. */
export function inventoryRoutes(ctx: AppContext): Router {
  const r = Router()
  const inv = ctx.inventory

  r.get('/products', (req, res) => {
    res.json({ items: inv.listProducts(parse(productQuerySchema, req.query)) })
  })
  r.post('/products', (req, res) => {
    res.status(201).json(inv.createProduct(parse(productInputSchema, req.body), currentUser(res).id))
  })
  r.get('/products/:id', (req, res) => {
    res.json(inv.getProduct(idParam(req)))
  })
  r.patch('/products/:id', (req, res) => {
    const patch = parse(productPatchSchema, req.body)
    res.json(inv.updateProduct(idParam(req), { ...patch, supplier: patch.supplier ?? undefined }))
  })

  r.get('/categories', (_req, res) => {
    res.json({ items: ctx.catalog.listCategories() })
  })
  r.post('/categories', (req, res) => {
    res.status(201).json(inv.createCategory(parse(categoryInputSchema, req.body).name))
  })

  r.get('/warehouses', (_req, res) => {
    res.json({ items: inv.listWarehouses() })
  })
  r.post('/warehouses', (req, res) => {
    res.status(201).json(inv.createWarehouse(parse(warehouseInputSchema, req.body)))
  })
  r.patch('/warehouses/:id', (req, res) => {
    res.json(inv.updateWarehouse(idParam(req), parse(warehousePatchSchema, req.body)))
  })
  r.post('/warehouses/:id/locations', (req, res) => {
    res.status(201).json(inv.addLocation(idParam(req), parse(locationInputSchema, req.body).name))
  })
  r.get('/locations', (_req, res) => {
    res.json({ items: inv.listLocations() })
  })
  r.get('/locations/:id/stock', (req, res) => {
    res.json({ items: inv.stockAtLocation(idParam(req)) })
  })

  r.get('/moves', (req, res) => {
    res.json(inv.listMoves(parse(moveQuerySchema, req.query)))
  })
  // Same filters as the ledger view, every matching row (capped), as a spreadsheet-friendly file.
  r.get('/moves.csv', (req, res) => {
    const filter = parse(moveQuerySchema.omit({ page: true, pageSize: true }), req.query)
    const { items, total } = inv.listMoves({ ...filter, page: 1, pageSize: MAX_CSV_ROWS })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="stocksense-moves-${ctx.now().toISOString().slice(0, 10)}.csv"`)
    if (total > MAX_CSV_ROWS) res.setHeader('X-Truncated', String(total))
    res.send(toCsv(items))
  })

  r.get('/dashboard', (req, res) => {
    res.json(ctx.dashboard.kpis(parse(dashboardQuerySchema, req.query)))
  })
  r.get('/analytics', (_req, res) => {
    res.json(ctx.analytics.compute())
  })
  r.get('/dashboard/insights', (req, res) => {
    res.json(ctx.dashboard.insights(parse(dashboardQuerySchema, req.query)))
  })
  r.post('/products/:id/reorder', (req, res) => {
    res.status(201).json(inv.createReorder(idParam(req), currentUser(res).id))
  })

  return r
}
