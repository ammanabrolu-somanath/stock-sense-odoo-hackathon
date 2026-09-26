import { z } from 'zod'

import { ADJUSTMENT_REASONS, OPERATION_STATUSES, OPERATION_TYPES, UOMS } from './types.ts'

/**
 * Request schemas — the single definition of "valid input", used by the API to validate
 * and by the web forms to validate before sending. Messages are written for end users.
 */

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254)
const password = z.string().min(8, 'Use at least 8 characters.').max(128, 'Use at most 128 characters.')
const id = z.coerce.number().int().positive()
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s || null)
    .nullish()

// ── Auth ──────────────────────────────────────────────────────────────────────
export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email,
  password,
})
export const loginSchema = z.object({ email, password: z.string().min(1, 'Enter your password.').max(128) })
export const otpRequestSchema = z.object({ email })
export const otpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.')
export const otpVerifySchema = z.object({ email, code: otpCode })
export const otpResetSchema = z.object({ email, code: otpCode, password })

// ── Master data ─────────────────────────────────────────────────────────────
export const categoryInputSchema = z.object({ name: z.string().trim().min(1, 'Enter a category name.').max(60) })

const productFields = {
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9._-]{1,31}$/, 'SKU: 2–32 letters, digits, dot, dash or underscore.'),
  name: z.string().trim().min(1, 'Enter a product name.').max(120),
  categoryId: z.coerce.number({ invalid_type_error: 'Choose a category.' }).int().positive('Choose a category.'),
  uom: z.enum(UOMS),
  cost: z.coerce.number().min(0, 'Cost cannot be negative.').max(10_000_000),
  price: z.coerce.number().min(0, 'Price cannot be negative.').max(10_000_000),
  reorderMin: z.coerce.number().min(0).max(10_000_000),
  reorderMax: z.coerce.number().min(0).max(10_000_000),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  supplier: optionalText(120),
}
/** Product fields without refinements — for forms that add their own (e.g. opening stock inputs). */
export const productFieldsSchema = z.object(productFields)

export const minMax = (v: { reorderMin?: number; reorderMax?: number }) =>
  v.reorderMin === undefined || v.reorderMax === undefined || v.reorderMax >= v.reorderMin
export const minMaxIssue = { message: 'Maximum must be at least the minimum.', path: ['reorderMax'] }

export const productInputSchema = z
  .object({
    ...productFields,
    initialStock: z
      .object({ locationId: id, qty: z.coerce.number().positive('Initial stock must be greater than zero.') })
      .nullish(),
  })
  .refine(minMax, minMaxIssue)
export type ProductInput = z.infer<typeof productInputSchema>

export const productPatchSchema = z
  .object({ ...productFields, archived: z.boolean() })
  .partial()
  .refine(minMax, minMaxIssue)

export const warehouseInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,5}$/, 'Code: 2–5 letters (e.g. HYD).'),
  name: z.string().trim().min(1, 'Enter a warehouse name.').max(80),
  city: z.string().trim().min(1, 'Enter a city.').max(60),
  capacityUnits: z.coerce.number().positive('Capacity must be greater than zero.').max(100_000_000),
})
export const warehousePatchSchema = warehouseInputSchema.omit({ code: true }).partial()
export const locationInputSchema = z.object({ name: z.string().trim().min(1, 'Enter a location name.').max(60) })

// ── Operations ──────────────────────────────────────────────────────────────
const lines = z
  .array(z.object({ productId: id, qty: z.coerce.number().min(0).max(10_000_000) }))
  .max(200, 'At most 200 lines per document.')

export const operationInputSchema = z.object({
  type: z.enum(OPERATION_TYPES),
  partner: optionalText(120),
  sourceLocationId: id.optional(),
  destLocationId: id.optional(),
  scheduledDate: z.string().datetime({ offset: true }).optional(),
  reason: z.enum(ADJUSTMENT_REASONS).nullish(),
  note: optionalText(500),
  lines,
})
export type OperationInputDto = z.infer<typeof operationInputSchema>

export const operationPatchSchema = operationInputSchema
  .pick({ partner: true, scheduledDate: true, reason: true, note: true, lines: true })
  .partial()

export const pickSchema = z.object({ lineId: id.nullish(), picked: z.boolean().default(true) })

export const operationQuerySchema = z.object({
  type: z.enum(OPERATION_TYPES).optional(),
  status: z.enum(OPERATION_STATUSES).optional(),
  warehouseId: id.optional(),
  locationId: id.optional(),
  categoryId: id.optional(),
  productId: id.optional(),
  q: z.string().trim().max(80).optional(),
})

export const moveQuerySchema = z.object({
  productId: id.optional(),
  locationId: id.optional(),
  warehouseId: id.optional(),
  type: z.enum(OPERATION_TYPES).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})
export type MoveQuery = z.infer<typeof moveQuerySchema>

export const productQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoryId: id.optional(),
  warehouseId: id.optional(),
  status: z.enum(['in_stock', 'low', 'out']).optional(),
})
