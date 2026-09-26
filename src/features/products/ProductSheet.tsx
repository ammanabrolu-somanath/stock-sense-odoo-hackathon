import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch, type FieldErrors, type Resolver } from 'react-hook-form'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import type { ProductDetail } from '@domain/api.ts'
import { minMax, minMaxIssue, productFieldsSchema } from '@domain/schemas.ts'
import { UOMS } from '@domain/types.ts'
import { FormAlert } from '@/components/shared/FormAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ApiError } from '@/lib/api'
import { UOM_LABEL } from '@/lib/format'
import { useCategories, useCreateCategory, useLocations, useSaveProduct } from './queries'

const formSchema = productFieldsSchema
  .extend({
    openingLocationId: z.string().optional(),
    openingQty: z.string().optional(),
  })
  .refine(minMax, minMaxIssue)
  .superRefine((v, ctx) => {
    const qty = v.openingQty?.trim()
    if (!qty) return
    if (!(Number(qty) > 0)) ctx.addIssue({ code: 'custom', path: ['openingQty'], message: 'Enter a quantity greater than zero.' })
    if (!v.openingLocationId) ctx.addIssue({ code: 'custom', path: ['openingLocationId'], message: 'Choose where the stock is.' })
  })

type FormValues = z.input<typeof formSchema>

/**
 * zod skips object-level refinements while any field is invalid, which would reveal
 * cross-field problems one submit later. Run them alongside so every error shows at once.
 */
function crossFieldErrors(v: FormValues): FieldErrors<FormValues> {
  const errors: FieldErrors<FormValues> = {}
  const min = Number(v.reorderMin)
  const max = Number(v.reorderMax)
  if (Number.isFinite(min) && Number.isFinite(max) && max < min) {
    errors.reorderMax = { type: 'custom', message: minMaxIssue.message }
  }
  const qty = v.openingQty?.trim()
  if (qty && !(Number(qty) > 0)) errors.openingQty = { type: 'custom', message: 'Enter a quantity greater than zero.' }
  if (qty && !v.openingLocationId) errors.openingLocationId = { type: 'custom', message: 'Choose where the stock is.' }
  return errors
}

const baseResolver = zodResolver(formSchema)
const resolver: Resolver<FormValues> = async (values, context, options) => {
  const result = await baseResolver(values, context, options)
  const extra = crossFieldErrors(values)
  if (Object.keys(extra).length === 0) return result
  return { values: {}, errors: { ...extra, ...result.errors } }
}

const UOM_NAME: Record<(typeof UOMS)[number], string> = { unit: 'Units', kg: 'Kilograms (kg)', m: 'Metres (m)', L: 'Litres (L)', box: 'Boxes' }

interface ProductSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductDetail
  onSaved?: (product: ProductDetail) => void
}

export function ProductSheet({ open, onOpenChange, product, onSaved }: ProductSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]">
        <SheetHeader className="border-b">
          <SheetTitle>{product ? `Edit ${product.name}` : 'New product'}</SheetTitle>
          <SheetDescription>
            {product ? 'Stock levels change only through operations — never by editing a number.' : 'Add a product, and optionally the stock you already hold.'}
          </SheetDescription>
        </SheetHeader>
        {open && <ProductForm product={product} onDone={(p) => { onOpenChange(false); onSaved?.(p) }} />}
      </SheetContent>
    </Sheet>
  )
}

function ProductForm({ product, onDone }: { product?: ProductDetail; onDone: (p: ProductDetail) => void }) {
  const categories = useCategories()
  const locations = useLocations()
  const createCategory = useCreateCategory()
  const save = useSaveProduct(product?.id)
  const [newCategory, setNewCategory] = useState<string | null>(null)

  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      name: product?.name ?? '',
      sku: product?.sku ?? '',
      categoryId: product?.categoryId,
      uom: product?.uom ?? 'unit',
      cost: product?.cost ?? 0,
      price: product?.price ?? 0,
      reorderMin: product?.reorderMin ?? 0,
      reorderMax: product?.reorderMax ?? 0,
      leadTimeDays: product?.leadTimeDays ?? 7,
      supplier: product?.supplier ?? '',
      openingLocationId: undefined,
      openingQty: '',
    },
  })
  const { errors } = form.formState
  const uom = useWatch({ control: form.control, name: 'uom' })

  const internal = (locations.data ?? []).filter((l) => l.kind === 'internal')
  const byWarehouse = new Map<string, typeof internal>()
  for (const l of internal) {
    const code = l.fullName.split('/')[0]
    byWarehouse.set(code, [...(byWarehouse.get(code) ?? []), l])
  }

  const onSubmit = form.handleSubmit((values) => {
    const { openingLocationId, openingQty, ...fields } = formSchema.parse(values)
    const body = product
      ? fields
      : { ...fields, initialStock: openingQty?.trim() ? { locationId: Number(openingLocationId), qty: Number(openingQty) } : null }
    save.mutate(body, {
      onSuccess: (saved) => {
        toast.success(product ? `Saved ${saved.name}` : `Created ${saved.name}`)
        onDone(saved)
      },
      onError: (e) => {
        if (!(e instanceof ApiError)) return
        for (const [field, messages] of Object.entries(e.fieldErrors)) {
          form.setError(field as keyof FormValues, { message: messages?.[0] })
        }
      },
    })
  })

  function addCategory() {
    const name = newCategory?.trim()
    if (!name) return
    createCategory.mutate(name, {
      onSuccess: (c) => {
        form.setValue('categoryId', c.id, { shouldValidate: true })
        setNewCategory(null)
      },
    })
  }

  const numberField = (name: 'cost' | 'price' | 'reorderMin' | 'reorderMax' | 'leadTimeDays', label: string, hint?: string) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} type="number" inputMode="decimal" min={0} step="any" aria-invalid={!!errors[name]} {...form.register(name)} />
      {errors[name] ? <FieldError errors={[errors[name]]} /> : hint && <FieldDescription>{hint}</FieldDescription>}
    </Field>
  )

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <div className="grid flex-1 gap-4 overflow-y-auto p-4">
        <FormAlert message={save.error?.message} />
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" autoFocus aria-invalid={!!errors.name} {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!errors.sku}>
            <FieldLabel htmlFor="sku">SKU / Code</FieldLabel>
            <Input id="sku" className="font-mono uppercase" aria-invalid={!!errors.sku} {...form.register('sku')} />
            <FieldError errors={[errors.sku]} />
          </Field>
          <Field data-invalid={!!errors.uom}>
            <FieldLabel htmlFor="uom">Unit of measure</FieldLabel>
            <Controller
              control={form.control}
              name="uom"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="uom" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UOMS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {UOM_NAME[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field data-invalid={!!errors.categoryId}>
          <FieldLabel htmlFor="category">Category</FieldLabel>
          {newCategory === null ? (
            <div className="flex gap-2">
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <Select value={field.value ? String(field.value) : ''} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.categoryId}>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Button type="button" variant="outline" size="icon" aria-label="New category" onClick={() => setNewCategory('')}>
                <Plus />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                id="category"
                autoFocus
                placeholder="New category name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCategory()
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setNewCategory(null)
                  }
                }}
              />
              <Button type="button" onClick={addCategory} disabled={createCategory.isPending}>
                Add
              </Button>
            </div>
          )}
          <FieldError errors={[errors.categoryId, createCategory.error ?? undefined]} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {numberField('cost', 'Cost (₹)')}
          {numberField('price', 'Sale price (₹)')}
        </div>

        <Separator />
        <div>
          <p className="text-sm font-medium">Reordering rule</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Reorder when on hand + incoming falls to the minimum; refill up to the maximum.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {numberField('reorderMin', 'Minimum')}
          {numberField('reorderMax', 'Maximum')}
          {numberField('leadTimeDays', 'Lead time (days)')}
        </div>
        <Field>
          <FieldLabel htmlFor="supplier">Supplier</FieldLabel>
          <Input id="supplier" autoComplete="off" {...form.register('supplier')} />
        </Field>

        {!product && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium">Opening stock <span className="font-normal text-muted-foreground">(optional)</span></p>
              <p className="mt-0.5 text-xs text-muted-foreground">Recorded as an “Initial stock” adjustment in the ledger, not a silent number.</p>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field data-invalid={!!errors.openingLocationId}>
                <FieldLabel htmlFor="openingLocation">Location</FieldLabel>
                <Controller
                  control={form.control}
                  name="openingLocationId"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger id="openingLocation" className="w-full" aria-invalid={!!errors.openingLocationId}>
                        <SelectValue placeholder="Choose a location" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...byWarehouse].map(([code, locs]) => (
                          <SelectGroup key={code}>
                            <SelectLabel>{code}</SelectLabel>
                            {locs.map((l) => (
                              <SelectItem key={l.id} value={String(l.id)}>
                                {l.fullName}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.openingLocationId]} />
              </Field>
              <Field data-invalid={!!errors.openingQty}>
                <FieldLabel htmlFor="openingQty">Quantity</FieldLabel>
                <Input id="openingQty" type="number" inputMode="decimal" min={0} step="any" aria-invalid={!!errors.openingQty} {...form.register('openingQty')} />
                <FieldError errors={[errors.openingQty]} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Quantities are in {UOM_LABEL[uom ?? 'unit']}.
            </p>
          </>
        )}
      </div>
      <SheetFooter className="flex-row justify-end border-t">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : product ? 'Save changes' : 'Create product'}
        </Button>
      </SheetFooter>
    </form>
  )
}
