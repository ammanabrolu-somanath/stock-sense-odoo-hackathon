import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, Trash2 } from 'lucide-react'

import type { ProductSummary } from '@domain/api.ts'
import type { Id } from '@domain/types.ts'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatNumber, uomLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface DraftLine {
  key: string
  productId: Id | null
  qty: string
}

let seq = 0
// oxlint-disable-next-line react/only-export-components -- factory shared with the form that owns the lines
export const newLine = (productId: Id | null = null, qty = ''): DraftLine => ({ key: `l${++seq}`, productId, qty })

interface LineEditorProps {
  lines: DraftLine[]
  onChange: (lines: DraftLine[]) => void
  products: ProductSummary[]
  /** On hand at the relevant location, per product; undefined when not applicable. */
  stockAt?: Map<Id, number>
  /** 'quantity' for receipts/deliveries/transfers; 'count' shows recorded vs counted vs difference. */
  mode: 'quantity' | 'count'
  availableLabel?: string
  qtyLabel: string
  error?: string
}

/** Product lines for any document type. Shortages are flagged inline before anything is sent. */
export function LineEditor({ lines, onChange, products, stockAt, mode, availableLabel = 'Available', qtyLabel, error }: LineEditorProps) {
  const byId = new Map(products.map((p) => [p.id, p]))
  const update = (key: string, patch: Partial<DraftLine>) => onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const remove = (key: string) => onChange(lines.filter((l) => l.key !== key))
  const showStock = stockAt !== undefined

  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-table">
          <caption className="sr-only">Product lines</caption>
          <thead>
            <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
              <th scope="col" className="h-9 px-3 text-left font-medium">Product</th>
              {showStock && <th scope="col" className="h-9 w-32 px-3 text-right font-medium">{mode === 'count' ? 'Recorded' : availableLabel}</th>}
              <th scope="col" className="h-9 w-36 px-3 text-right font-medium">{qtyLabel}</th>
              {mode === 'count' && <th scope="col" className="h-9 w-28 px-3 text-right font-medium">Difference</th>}
              <th scope="col" className="h-9 w-10 px-1"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const product = line.productId ? byId.get(line.productId) : undefined
              const onHand = line.productId && stockAt ? (stockAt.get(line.productId) ?? 0) : null
              const qty = Number(line.qty)
              const hasQty = line.qty.trim() !== '' && Number.isFinite(qty)
              // Demand for the same product across lines counts together, exactly like the server does.
              const demand = lines.filter((l) => l.productId === line.productId).reduce((s, l) => s + (Number(l.qty) || 0), 0)
              const short = mode === 'quantity' && onHand !== null && hasQty && demand > onHand
              const diff = mode === 'count' && onHand !== null && hasQty ? qty - onHand : null
              return (
                <tr key={line.key} className="border-b last:border-0">
                  <td className="px-2 py-1.5">
                    <ProductPicker
                      products={products}
                      value={line.productId}
                      onChange={(productId) => update(line.key, { productId })}
                      label={`Product for line ${i + 1}`}
                    />
                  </td>
                  {showStock && (
                    <td className="px-3 text-right tabular-nums text-muted-foreground">
                      {onHand === null ? '—' : `${formatNumber(onHand)} ${product ? uomLabel(product.uom, onHand) : ''}`}
                    </td>
                  )}
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={line.qty}
                      onChange={(e) => update(line.key, { qty: e.target.value })}
                      aria-label={`${qtyLabel} for line ${i + 1}`}
                      aria-invalid={short || undefined}
                      className={cn('h-8 text-right tabular-nums', short && 'border-danger')}
                    />
                    {short && (
                      <p className="mt-1 text-right text-xs text-danger" role="status">
                        Only {formatNumber(onHand!)} available
                      </p>
                    )}
                  </td>
                  {mode === 'count' && (
                    <td
                      className={cn(
                        'px-3 text-right font-medium tabular-nums',
                        diff !== null && diff > 0 && 'text-success',
                        diff !== null && diff < 0 && 'text-danger',
                      )}
                    >
                      {diff === null ? '—' : diff === 0 ? <span className="font-normal text-muted-foreground">No change</span> : `${diff > 0 ? '+' : ''}${formatNumber(diff)}`}
                    </td>
                  )}
                  <td className="px-1 text-center">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} onClick={() => remove(line.key)}>
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              )
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No products yet. Add a line to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...lines, newLine()])}>
        <Plus data-icon="inline-start" />
        Add product
      </Button>
    </div>
  )
}

function ProductPicker({ products, value, onChange, label }: { products: ProductSummary[]; value: Id | null; onChange: (id: Id) => void; label: string }) {
  const [open, setOpen] = useState(false)
  const selected = value ? products.find((p) => p.id === value) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={label} className="h-8 w-full min-w-56 justify-between font-normal">
          {selected ? (
            <span className="truncate">
              {selected.name} <span className="font-mono text-xs text-muted-foreground">{selected.sku}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Choose a product</span>
          )}
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search name or SKU" />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.sku}`}
                  onSelect={() => {
                    onChange(p.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn('size-3.5', p.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{p.sku}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
