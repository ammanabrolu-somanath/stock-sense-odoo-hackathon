import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { History, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import type { OperationView } from '@domain/api.ts'
import type { OperationType } from '@domain/types.ts'
import { NotFoundPage } from '@/app/NotFoundPage'
import { FormAlert } from '@/components/shared/FormAlert'
import { OperationStatusBadge } from '@/components/shared/StatusBadge'
import { StatusPipeline } from '@/components/shared/StatusPipeline'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProducts } from '@/features/products/queries'
import { ApiError, qs } from '@/lib/api'
import { formatDate, formatDateTime, formatNumber, uomLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import { OPERATION_CONFIG } from './config'
import { LineEditor, newLine, type DraftLine } from './LineEditor'
import { PickPackPanel } from './PickPackPanel'
import { useLocationStock, useOperation, useOperationAction, useUpdateOperation, type OperationAction } from './queries'
import { isOverdue, toLinePayload, validateLines } from './utils'

export function OperationDetailPage({ type }: { type: OperationType }) {
  const id = Number(useParams().operationId)
  const query = useOperation(Number.isInteger(id) ? id : undefined)

  if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage />
  if (query.data && query.data.type !== type) return <NotFoundPage />
  if (!query.data) return <DetailSkeleton />
  // Keyed by status so local UI state (e.g. draft line edits) resets when the document moves on.
  return <OperationDetail key={`${query.data.id}:${query.data.status}`} op={query.data} />
}

function OperationDetail({ op }: { op: OperationView }) {
  const config = OPERATION_CONFIG[op.type]
  const navigate = useNavigate()
  const action = useOperationAction(op.id)
  // Unsaved draft line edits would silently not be what gets confirmed/validated — block actions until saved.
  const [linesDirty, setLinesDirty] = useState(false)

  function run(name: OperationAction, body?: unknown) {
    action.mutate(
      { action: name, body },
      {
        onSuccess: (next) => {
          if (name === 'validate') {
            toast.success(`${next.reference} validated — stock updated`, {
              action: { label: 'View moves', onClick: () => navigate(`/moves${qs({ q: next.reference })}`) },
            })
          } else if (name === 'cancel') toast(`${next.reference} canceled`)
          else if (name === 'check') toast(next.status === 'ready' ? 'Stock is available — ready to go' : 'Still waiting for stock')
          else if (name === 'confirm') toast(next.status === 'ready' ? `${next.reference} is ready` : `${next.reference} is waiting for stock`)
        },
        onError: (e) => {
          // The server has already moved the document back to Waiting; keep its explanation visible.
          if (e instanceof ApiError && e.code === 'INSUFFICIENT_STOCK') toast.error(e.message)
        },
      },
    )
  }

  const busy = action.isPending || linesDirty
  const open = op.status === 'draft' || op.status === 'waiting' || op.status === 'ready'
  const late = isOverdue(op)
  const allPicked = op.lines.every((l) => l.picked)

  // One primary action per state; the server enforces the same rules regardless.
  let primary: ReactNode = null
  if (op.status === 'draft') {
    primary =
      op.type === 'delivery' ? (
        <Button disabled={busy} onClick={() => run('confirm')}>Confirm order</Button>
      ) : (
        <>
          <Button variant="outline" disabled={busy} onClick={() => run('confirm')}>Mark as ready</Button>
          <Button disabled={busy} onClick={() => run('validate')}>{config.validateLabel}</Button>
        </>
      )
  } else if (op.status === 'waiting') {
    primary = (
      <Button disabled={busy} onClick={() => run('check')}>
        <RefreshCw data-icon="inline-start" />
        Check availability
      </Button>
    )
  } else if (op.status === 'ready') {
    // Stock can move after confirmation; let the user re-sync explicitly (validate also does).
    const recheck =
      op.type === 'delivery' || op.type === 'transfer' ? (
        <Button variant="outline" disabled={busy} onClick={() => run('check')}>
          <RefreshCw data-icon="inline-start" />
          Check availability
        </Button>
      ) : null
    primary =
      op.type === 'delivery' ? (
        <>
          {recheck}
          <Button disabled={busy || !op.packedAt || !allPicked} onClick={() => run('validate')}>{config.validateLabel}</Button>
        </>
      ) : (
        <>
          {recheck}
          <Button disabled={busy} onClick={() => run('validate')}>{config.validateLabel}</Button>
        </>
      )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{config.label}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight">{op.reference}</h1>
            <OperationStatusBadge status={op.status} />
            {late && <span className="text-xs font-medium text-danger">Overdue</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {open && <CancelButton reference={op.reference} busy={busy} onConfirm={() => run('cancel')} />}
          {primary}
          {op.status === 'done' && (
            <Button variant="outline" asChild>
              <Link to={`/moves${qs({ q: op.reference })}`}>
                <History data-icon="inline-start" />
                View moves
              </Link>
            </Button>
          )}
        </div>
      </div>

      <StatusPipeline op={op} className="mb-4" />

      <div className="mb-4 grid gap-2" aria-live="polite">
        {action.error && <FormAlert message={action.error.message} />}
        {op.status === 'waiting' && !action.error && <ShortageNote op={op} />}
        {op.status === 'done' && (
          <p className="rounded-md border border-success/25 bg-success/5 px-3 py-2 text-sm">
            Validated {formatDateTime(op.doneAt!)}. This document is now part of the ledger and can’t be changed — correct stock with an adjustment.
          </p>
        )}
        {op.status === 'canceled' && <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">Canceled. No stock was moved.</p>}
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
        {config.partner && <Info label={config.partner.label}>{op.partner ?? '—'}</Info>}
        {op.type !== 'adjustment' && <Info label="From" mono>{op.sourceLocation}</Info>}
        <Info label={op.type === 'adjustment' ? 'Counted location' : 'To'} mono>
          {op.destLocation}
        </Info>
        {op.type === 'adjustment' && <Info label="Reason">{op.reason ?? '—'}</Info>}
        <Info label={op.type === 'adjustment' ? 'Count date' : 'Scheduled'}>
          <span className={cn(late && 'font-medium text-danger')}>{formatDate(op.scheduledDate)}</span>
        </Info>
        {op.note && (
          <div className="col-span-2 sm:col-span-4">
            <dt className="text-xs text-muted-foreground">Note</dt>
            <dd className="mt-0.5">{op.note}</dd>
          </div>
        )}
      </dl>

      {op.type === 'delivery' && op.status === 'ready' && (
        <div className="mb-6">
          <PickPackPanel op={op} busy={busy} run={run} />
        </div>
      )}

      {op.status === 'draft' ? <DraftLines op={op} onDirtyChange={setLinesDirty} /> : <ReadOnlyLines op={op} />}
      {action.isPending && <span className="sr-only" role="status">Working…</span>}
    </>
  )
}

function Info({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 truncate', mono && 'font-mono text-xs')}>{children}</dd>
    </div>
  )
}

function ShortageNote({ op }: { op: OperationView }) {
  const short = op.lines.filter((l) => l.available !== null && l.qty > l.available)
  if (short.length === 0) return null
  return (
    <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
      <p className="font-medium">Waiting for stock at {op.sourceLocation}</p>
      <ul className="mt-1 text-xs text-muted-foreground">
        {short.map((l) => (
          <li key={l.id}>
            {l.productName}: {formatNumber(l.available!)} of {formatNumber(l.qty)} {uomLabel(l.uom, l.qty)} available
          </li>
        ))}
      </ul>
    </div>
  )
}

function CancelButton({ reference, busy, onConfirm }: { reference: string; busy: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" disabled={busy} className="text-muted-foreground">
          Cancel document
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {reference}?</AlertDialogTitle>
          <AlertDialogDescription>No stock will move. A canceled document can’t be reopened — you would create a new one.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Cancel document</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Draft documents are editable in place; everything after Draft is read-only. */
function DraftLines({ op, onDirtyChange }: { op: OperationView; onDirtyChange: (dirty: boolean) => void }) {
  const config = OPERATION_CONFIG[op.type]
  const products = useProducts()
  const update = useUpdateOperation(op.id)
  const stockLocation = config.availableAt === 'source' ? op.sourceLocationId : config.availableAt === 'dest' ? op.destLocationId : undefined
  const stock = useLocationStock(stockLocation)
  const initial = () => op.lines.map((l) => newLine(l.productId, String(l.qty)))
  const [lines, setLinesState] = useState<DraftLine[]>(initial)
  const saved = JSON.stringify(op.lines.map((l) => ({ productId: l.productId, qty: l.qty })))
  const isDirty = (next: DraftLine[]) => JSON.stringify(toLinePayload(next)) !== saved
  const setLines = (next: DraftLine[]) => {
    setLinesState(next)
    onDirtyChange(isDirty(next))
  }
  const [error, setError] = useState<string>()
  const mode = op.type === 'adjustment' ? 'count' : 'quantity'
  const dirty = isDirty(lines)

  function save() {
    const problem = validateLines(lines, mode)
    setError(problem)
    if (problem) return
    update.mutate(
      { lines: toLinePayload(lines) },
      {
        onSuccess: () => {
          onDirtyChange(false)
          toast.success('Lines saved')
        },
      },
    )
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium">Products</h2>
        {dirty && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setLines(initial())}>
              Discard changes
            </Button>
            <Button size="sm" onClick={save} disabled={update.isPending}>
              Save lines
            </Button>
          </div>
        )}
      </div>
      {update.error && <FormAlert message={update.error.message} />}
      <LineEditor
        lines={lines}
        onChange={setLines}
        products={products.data ?? []}
        stockAt={stockLocation !== undefined ? (stock.data ?? new Map()) : undefined}
        mode={mode}
        qtyLabel={config.qtyLabel}
        error={error}
      />
      {dirty && <p className="mt-2 text-xs text-warning">Save or discard your line changes to continue — actions are paused so nothing unsaved is validated.</p>}
    </section>
  )
}

function ReadOnlyLines({ op }: { op: OperationView }) {
  const config = OPERATION_CONFIG[op.type]
  const count = op.type === 'adjustment'
  const showAvailable = op.lines.some((l) => l.available !== null) && !count
  const done = op.status === 'done'

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium">Products</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-table">
          <caption className="sr-only">Product lines</caption>
          <thead>
            <tr className="border-b bg-muted/60 text-xs text-muted-foreground">
              <th scope="col" className="h-9 px-3 text-left font-medium">Product</th>
              {showAvailable && <th scope="col" className="h-9 px-3 text-right font-medium">Available</th>}
              {count && <th scope="col" className="h-9 px-3 text-right font-medium">Recorded</th>}
              <th scope="col" className="h-9 px-3 text-right font-medium">{config.qtyLabel}</th>
              {count && <th scope="col" className="h-9 px-3 text-right font-medium">Difference</th>}
              {op.type === 'delivery' && <th scope="col" className="h-9 px-3 text-right font-medium">Picked</th>}
            </tr>
          </thead>
          <tbody>
            {op.lines.map((l) => {
              const recorded = done ? l.systemQty : l.available
              const diff = recorded === null || recorded === undefined ? null : l.qty - recorded
              const short = showAvailable && l.available !== null && l.qty > l.available
              return (
                <tr key={l.id} className="h-9 border-b last:border-0">
                  <td className="px-3">
                    <Link to={`/products/${l.productId}`} className="hover:underline">
                      {l.productName}
                    </Link>{' '}
                    <span className="font-mono text-xs text-muted-foreground">{l.sku}</span>
                  </td>
                  {showAvailable && (
                    <td className={cn('px-3 text-right tabular-nums', short ? 'font-medium text-danger' : 'text-muted-foreground')}>
                      {l.available === null ? '—' : formatNumber(l.available)}
                    </td>
                  )}
                  {count && <td className="px-3 text-right tabular-nums text-muted-foreground">{recorded === null || recorded === undefined ? '—' : formatNumber(recorded)}</td>}
                  <td className="px-3 text-right font-medium tabular-nums">
                    {formatNumber(l.qty)} <span className="font-normal text-muted-foreground">{uomLabel(l.uom, l.qty)}</span>
                  </td>
                  {count && (
                    <td className={cn('px-3 text-right font-medium tabular-nums', diff !== null && diff > 0 && 'text-success', diff !== null && diff < 0 && 'text-danger')}>
                      {diff === null ? '—' : diff === 0 ? <span className="font-normal text-muted-foreground">No change</span> : `${diff > 0 ? '+' : ''}${formatNumber(diff)}`}
                    </td>
                  )}
                  {op.type === 'delivery' && <td className="px-3 text-right text-muted-foreground">{l.picked ? 'Yes' : 'No'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading document">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-2 h-7 w-56" />
      <Skeleton className="mt-4 h-6 w-96 max-w-full" />
      <Skeleton className="mt-6 h-20 w-full" />
      <Skeleton className="mt-6 h-40 w-full" />
    </div>
  )
}

