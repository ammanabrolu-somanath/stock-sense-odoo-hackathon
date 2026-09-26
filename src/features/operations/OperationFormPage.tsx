import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ADJUSTMENT_REASONS, type AdjustmentReason, type Id, type OperationType } from '@domain/types.ts'
import { FormAlert } from '@/components/shared/FormAlert'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useLocations, useProducts } from '@/features/products/queries'
import { OPERATION_CONFIG, operationUrl } from './config'
import { LineEditor, newLine, type DraftLine } from './LineEditor'
import { LocationSelect } from './LocationSelect'
import { useCreateOperation, useLocationStock } from './queries'
import { dateInputToIso, isoToDateInput, toLinePayload, validateLines } from './utils'

type Errors = Partial<Record<'partner' | 'source' | 'dest' | 'lines' | 'date', string>>

export function OperationFormPage({ type }: { type: OperationType }) {
  const config = OPERATION_CONFIG[type]
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const locations = useLocations()
  const products = useProducts()
  const create = useCreateOperation()

  const prefillProduct = Number(params.get('productId')) || null
  const prefillQty = params.get('qty') ?? ''
  const [partner, setPartner] = useState('')
  const [source, setSource] = useState<Id | undefined>(Number(params.get('sourceLocationId')) || undefined)
  const [dest, setDest] = useState<Id | undefined>(Number(params.get('destLocationId')) || undefined)
  const [reason, setReason] = useState<AdjustmentReason>('Cycle count')
  const [date, setDate] = useState(isoToDateInput(new Date().toISOString()))
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine(prefillProduct, prefillProduct ? prefillQty : '')])
  const [errors, setErrors] = useState<Errors>({})

  // Receipts pre-fill the supplier from the product being reordered.
  const prefilled = prefillProduct ? products.data?.find((p) => p.id === prefillProduct) : undefined
  const [partnerTouched, setPartnerTouched] = useState(false)
  const partnerValue = !partnerTouched && type === 'receipt' && prefilled?.supplier ? prefilled.supplier : partner

  const stockLocation = config.availableAt === 'source' ? source : config.availableAt === 'dest' ? dest : undefined
  const stock = useLocationStock(stockLocation)
  const mode = type === 'adjustment' ? 'count' : 'quantity'

  function submit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    if (config.source && !source) next.source = 'Choose where the stock comes from.'
    if (config.dest && !dest) next.dest = type === 'adjustment' ? 'Choose the location you counted.' : 'Choose where the stock goes.'
    if (type === 'transfer' && source && source === dest) next.dest = 'Choose a different location from the source.'
    if (!date) next.date = 'Choose a date.'
    const lineError = validateLines(lines, mode)
    if (lineError) next.lines = lineError
    setErrors(next)
    if (Object.keys(next).length) return

    create.mutate(
      {
        type,
        partner: config.partner ? partnerValue.trim() || null : undefined,
        sourceLocationId: config.source ? source : undefined,
        destLocationId: config.dest ? dest : undefined,
        reason: type === 'adjustment' ? reason : undefined,
        scheduledDate: dateInputToIso(date),
        note: note.trim() || null,
        lines: toLinePayload(lines),
      },
      {
        onSuccess: (op) => {
          toast.success(`${op.reference} created as a draft`)
          navigate(operationUrl(type, op.id))
        },
      },
    )
  }

  const locs = locations.data ?? []

  return (
    <>
      <PageHeader title={`New ${config.label.toLowerCase()}`} description={config.description} />
      <form onSubmit={submit} noValidate className="grid max-w-4xl gap-6">
        <FormAlert message={create.error?.message} />
        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
          {config.partner && (
            <Field>
              <FieldLabel htmlFor="partner">{config.partner.label}</FieldLabel>
              <Input
                id="partner"
                value={partnerValue}
                placeholder={config.partner.placeholder}
                onChange={(e) => {
                  setPartnerTouched(true)
                  setPartner(e.target.value)
                }}
              />
            </Field>
          )}
          {config.source && (
            <Field data-invalid={!!errors.source}>
              <FieldLabel htmlFor="source">{config.source.label}</FieldLabel>
              <LocationSelect id="source" locations={locs} value={source} onChange={setSource} invalid={!!errors.source} />
              <FieldError>{errors.source}</FieldError>
            </Field>
          )}
          {config.dest && (
            <Field data-invalid={!!errors.dest}>
              <FieldLabel htmlFor="dest">{config.dest.label}</FieldLabel>
              <LocationSelect id="dest" locations={locs} value={dest} onChange={setDest} invalid={!!errors.dest} exclude={type === 'transfer' ? source : undefined} />
              <FieldError>{errors.dest}</FieldError>
            </Field>
          )}
          {type === 'adjustment' && (
            <Field>
              <FieldLabel htmlFor="reason">Reason</FieldLabel>
              <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
                <SelectTrigger id="reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_REASONS.filter((r) => r !== 'Initial stock').map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="date">{type === 'adjustment' ? 'Count date' : 'Scheduled date'}</FieldLabel>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date} />
            <FieldError>{errors.date}</FieldError>
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="note">Note</FieldLabel>
            <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — visible on the document" />
          </Field>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-medium">Products</h2>
          {stockLocation === undefined && config.availableAt && (
            <FieldDescription className="mb-2">
              {config.availableAt === 'source' ? 'Choose the source location to see what is available.' : 'Choose the counted location to see recorded quantities.'}
            </FieldDescription>
          )}
          <LineEditor
            lines={lines}
            onChange={setLines}
            products={products.data ?? []}
            stockAt={stockLocation !== undefined ? (stock.data ?? new Map()) : undefined}
            mode={mode}
            qtyLabel={config.qtyLabel}
            availableLabel="Available"
            error={errors.lines}
          />
        </section>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => navigate(operationUrl(type))}>
            Discard
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : `Create ${config.label.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </>
  )
}
