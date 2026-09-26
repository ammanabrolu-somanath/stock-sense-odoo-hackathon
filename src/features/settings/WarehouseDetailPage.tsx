import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

import type { WarehouseSummary } from '@domain/api.ts'
import { locationInputSchema, warehousePatchSchema } from '@domain/schemas.ts'
import { NotFoundPage } from '@/app/NotFoundPage'
import { FormAlert } from '@/components/shared/FormAlert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useWarehouses } from '@/features/products/queries'
import { qs } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useAddLocation, useUpdateWarehouse } from './queries'
import { UtilizationBar } from './UtilizationBar'
import { WarehouseMap } from './WarehouseMap'

export function WarehouseDetailPage() {
  const id = Number(useParams().warehouseId)
  const warehouses = useWarehouses()
  if (!warehouses.data) return <Skeleton className="h-64 w-full" role="status" aria-label="Loading warehouse" />
  const wh = warehouses.data.find((w) => w.id === id)
  if (!wh) return <NotFoundPage />
  return <WarehouseDetail key={wh.id} wh={wh} />
}

function WarehouseDetail({ wh }: { wh: WarehouseSummary }) {
  return (
    <>
      <div className="mb-6">
        <p className="font-mono text-xs font-medium tracking-wide text-muted-foreground">{wh.code}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{wh.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {wh.city} · {formatNumber(wh.onHand)} of {formatNumber(wh.capacityUnits)} units
        </p>
        <UtilizationBar value={wh.utilization} capacity={wh.capacityUnits} className="mt-3 max-w-md" />
      </div>
      <WarehouseMap wh={wh} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Locations wh={wh} />
        <Details wh={wh} />
      </div>
    </>
  )
}

function Locations({ wh }: { wh: WarehouseSummary }) {
  const add = useAddLocation(wh.id)
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = locationInputSchema.safeParse({ name })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setError(undefined)
    add.mutate(parsed.data.name, {
      onSuccess: (l) => {
        toast.success(`${l.fullName} added`)
        setName('')
      },
    })
  }

  return (
    <section className="rounded-lg border lg:col-span-2">
      <header className="flex h-11 items-center border-b px-4">
        <h2 className="text-sm font-medium">Locations</h2>
      </header>
      <table className="w-full text-table">
        <caption className="sr-only">Locations in {wh.name}</caption>
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="h-9 px-4 text-left font-medium">Location</th>
            <th scope="col" className="h-9 px-4 text-right font-medium">Units on hand</th>
          </tr>
        </thead>
        <tbody>
          {wh.locations.map((l) => (
            <tr key={l.id} className="h-9 border-b last:border-0">
              <td className="px-4 font-mono text-xs">{l.fullName}</td>
              <td className="px-4 text-right tabular-nums">
                <Link to={`/moves${qs({ locationId: l.id })}`} className="underline decoration-border decoration-dotted underline-offset-4 hover:decoration-foreground">
                  {formatNumber(l.onHand)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={submit} noValidate className="flex items-start gap-2 border-t p-3">
        <div className="flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New location, e.g. Rack C" aria-label="New location name" aria-invalid={!!error || undefined} />
          {(error || add.error) && <p className="mt-1 text-xs text-danger" role="alert">{error ?? add.error?.message}</p>}
        </div>
        <Button type="submit" variant="outline" disabled={add.isPending}>
          <Plus data-icon="inline-start" />
          Add location
        </Button>
      </form>
    </section>
  )
}

function Details({ wh }: { wh: WarehouseSummary }) {
  const update = useUpdateWarehouse(wh.id)
  const [values, setValues] = useState({ name: wh.name, city: wh.city, capacityUnits: String(wh.capacityUnits) })
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const dirty = values.name !== wh.name || values.city !== wh.city || Number(values.capacityUnits) !== wh.capacityUnits

  function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = warehousePatchSchema.safeParse(values)
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      return setErrors({ name: f.name?.[0], city: f.city?.[0], capacityUnits: f.capacityUnits?.[0] })
    }
    setErrors({})
    update.mutate(parsed.data, { onSuccess: () => toast.success('Warehouse saved') })
  }

  return (
    <section className="rounded-lg border">
      <header className="flex h-11 items-center border-b px-4">
        <h2 className="text-sm font-medium">Details</h2>
      </header>
      <form onSubmit={submit} noValidate className="grid gap-4 p-4">
        <FormAlert message={update.error?.message} />
        {(['name', 'city', 'capacityUnits'] as const).map((key) => (
          <Field key={key} data-invalid={!!errors[key]}>
            <FieldLabel htmlFor={`wh-${key}`}>{key === 'capacityUnits' ? 'Capacity (units)' : key === 'name' ? 'Name' : 'City'}</FieldLabel>
            <Input
              id={`wh-${key}`}
              type={key === 'capacityUnits' ? 'number' : 'text'}
              value={values[key]}
              aria-invalid={!!errors[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
            <FieldError>{errors[key]}</FieldError>
          </Field>
        ))}
        <p className="text-xs text-muted-foreground">The code ({wh.code}) is part of every document reference, so it can’t change.</p>
        <Button type="submit" disabled={!dirty || update.isPending} className="justify-self-end">
          Save
        </Button>
      </form>
    </section>
  )
}
