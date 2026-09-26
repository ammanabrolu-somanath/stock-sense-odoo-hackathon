import { PackageCheck } from 'lucide-react'

import type { OperationView } from '@domain/api.ts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDateTime, formatNumber, uomLabel } from '@/lib/format'
import type { OperationAction } from './queries'

/**
 * The spec's delivery process — pick items, pack items — inside the Ready state.
 * Validation stays disabled server-side until both are complete.
 */
export function PickPackPanel({
  op,
  busy,
  run,
}: {
  op: OperationView
  busy: boolean
  run: (action: OperationAction, body?: unknown) => void
}) {
  const picked = op.lines.filter((l) => l.picked).length
  const allPicked = picked === op.lines.length && op.lines.length > 0

  return (
    <section className="rounded-lg border">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <div>
          <h2 className="text-sm font-medium">Pick &amp; pack</h2>
          <p className="text-xs text-muted-foreground">
            {op.packedAt ? `Packed ${formatDateTime(op.packedAt)} — ready to validate.` : `${picked} of ${op.lines.length} lines picked`}
          </p>
        </div>
        <div className="flex gap-2">
          {!allPicked && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run('pick')}>
              Pick all
            </Button>
          )}
          {!op.packedAt && (
            <Button size="sm" variant={allPicked ? 'default' : 'outline'} disabled={busy || !allPicked} onClick={() => run('pack')}>
              <PackageCheck data-icon="inline-start" />
              Mark packed
            </Button>
          )}
        </div>
      </header>
      <ul className="divide-y">
        {op.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-2 text-table">
            <Checkbox
              id={`pick-${l.id}`}
              checked={l.picked}
              disabled={busy}
              onCheckedChange={(v) => run('pick', { lineId: l.id, picked: v === true })}
              aria-label={`Picked: ${l.productName}`}
            />
            <label htmlFor={`pick-${l.id}`} className="flex-1 cursor-pointer">
              {l.productName} <span className="font-mono text-xs text-muted-foreground">{l.sku}</span>
            </label>
            <span className="tabular-nums">
              {formatNumber(l.qty)} <span className="text-muted-foreground">{uomLabel(l.uom, l.qty)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
