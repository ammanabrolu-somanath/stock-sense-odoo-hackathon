import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Warehouse } from 'lucide-react'
import { toast } from 'sonner'

import type { WarehouseSummary } from '@domain/api.ts'
import { warehouseInputSchema } from '@domain/schemas.ts'
import { DataTable } from '@/components/shared/DataTable'
import { columnsFor } from '@/components/shared/data-table'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormAlert } from '@/components/shared/FormAlert'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useWarehouses } from '@/features/products/queries'
import { formatNumber } from '@/lib/format'
import { useCreateWarehouse } from './queries'
import { UtilizationBar } from './UtilizationBar'

const col = columnsFor<WarehouseSummary>()
const columns = [
  col.accessor('code', { header: 'Code', sortFn: 'text', cell: (c) => <span className="font-mono text-xs font-medium">{c.getValue()}</span> }),
  col.accessor('name', { header: 'Warehouse', sortFn: 'text', cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
  col.accessor('city', { header: 'City', sortFn: 'text', meta: { className: 'hidden sm:table-cell' }, cell: (c) => <span className="text-muted-foreground">{c.getValue()}</span> }),
  col.display({
    id: 'locations',
    header: 'Locations',
    meta: { align: 'right', className: 'hidden md:table-cell' },
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.locations.length}</span>,
  }),
  col.accessor('onHand', { header: 'Units on hand', sortFn: 'basic', meta: { align: 'right' }, cell: (c) => <span className="tabular-nums">{formatNumber(c.getValue())}</span> }),
  col.accessor('utilization', {
    header: 'Utilization',
    sortFn: 'basic',
    meta: { className: 'w-56' },
    cell: ({ row }) => <UtilizationBar value={row.original.utilization} capacity={row.original.capacityUnits} />,
  }),
]

export function WarehousesPage() {
  const navigate = useNavigate()
  const warehouses = useWarehouses()
  const [open, setOpen] = useState(false)

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Sites and their locations. Utilization is units on hand against each site's capacity."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus data-icon="inline-start" />
            New warehouse
          </Button>
        }
      />
      <DataTable
        caption="Warehouses"
        data={warehouses.data}
        columns={columns}
        isLoading={warehouses.isPending}
        getRowId={(w) => String(w.id)}
        rowLabel={(w) => `${w.code} ${w.name}`}
        onRowOpen={(w) => navigate(`/settings/warehouses/${w.id}`)}
        empty={<EmptyState icon={Warehouse} title="No warehouses yet" />}
      />
      <NewWarehouseDialog open={open} onOpenChange={setOpen} onCreated={(w) => navigate(`/settings/warehouses/${w.id}`)} />
    </>
  )
}

function NewWarehouseDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (w: WarehouseSummary) => void }) {
  const create = useCreateWarehouse()
  const [values, setValues] = useState({ code: '', name: '', city: '', capacityUnits: '' })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = warehouseInputSchema.safeParse(values)
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      setErrors({ code: f.code?.[0], name: f.name?.[0], city: f.city?.[0], capacityUnits: f.capacityUnits?.[0] })
      return
    }
    setErrors({})
    create.mutate(parsed.data, {
      onSuccess: (w) => {
        toast.success(`${w.code} created with a Stock location`)
        onOpenChange(false)
        setValues({ code: '', name: '', city: '', capacityUnits: '' })
        onCreated(w)
      },
    })
  }

  const field = (key: keyof typeof values, label: string, props: Record<string, unknown> = {}) => (
    <Field data-invalid={!!errors[key]}>
      <FieldLabel htmlFor={`wh-${key}`}>{label}</FieldLabel>
      <Input id={`wh-${key}`} value={values[key]} aria-invalid={!!errors[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} {...props} />
      <FieldError>{errors[key]}</FieldError>
    </Field>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New warehouse</DialogTitle>
          <DialogDescription>A “Stock” location is created automatically; add racks and floors afterwards.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormAlert message={create.error?.message} />
          <div className="grid grid-cols-[120px_1fr] gap-3">
            {field('code', 'Code', { className: 'font-mono uppercase', placeholder: 'DEL', maxLength: 5 })}
            {field('name', 'Name', { placeholder: 'Delhi Depot' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('city', 'City')}
            {field('capacityUnits', 'Capacity (units)', { type: 'number', inputMode: 'numeric', min: 1 })}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              Create warehouse
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
