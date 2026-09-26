import { Router } from 'express'

import {
  categoryInputSchema,
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

/** Products, categories, warehouses, locations and the move ledger. */
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

  r.get('/moves', (req, res) => {
    res.json(inv.listMoves(parse(moveQuerySchema, req.query)))
  })

  return r
}
