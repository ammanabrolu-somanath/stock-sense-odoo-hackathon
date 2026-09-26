import { Check } from 'lucide-react'

import type { OperationView } from '@domain/api.ts'
import { cn } from '@/lib/utils'

type Step = { key: string; label: string }

/**
 * Odoo-style lifecycle stepper. Deliveries expose the spec's pick → pack stages inside
 * Ready; "Waiting" appears only when the document is (or can be) waiting on stock.
 */
function pipelineFor(op: Pick<OperationView, 'type' | 'status' | 'packedAt' | 'lines'>): { steps: Step[]; current: number } {
  const canWait = op.type === 'delivery' || op.type === 'transfer'
  const steps: Step[] = [{ key: 'draft', label: 'Draft' }]
  if (canWait && op.status === 'waiting') steps.push({ key: 'waiting', label: 'Waiting' })
  steps.push({ key: 'ready', label: 'Ready' })
  if (op.type === 'delivery') steps.push({ key: 'picked', label: 'Picked' }, { key: 'packed', label: 'Packed' })
  steps.push({ key: 'done', label: 'Done' })

  const allPicked = op.lines.length > 0 && op.lines.every((l) => l.picked)
  const stage =
    op.status === 'ready' && op.type === 'delivery'
      ? op.packedAt
        ? 'packed'
        : allPicked
          ? 'picked'
          : 'ready'
      : op.status === 'canceled'
        ? 'draft'
        : op.status
  return { steps, current: Math.max(0, steps.findIndex((s) => s.key === stage)) }
}

export function StatusPipeline({ op, className }: { op: Pick<OperationView, 'type' | 'status' | 'packedAt' | 'lines'>; className?: string }) {
  const { steps, current } = pipelineFor(op)
  const canceled = op.status === 'canceled'
  const done = op.status === 'done'

  return (
    <ol aria-label="Document status" className={cn('flex flex-wrap items-center gap-x-1 gap-y-2 text-xs', canceled && 'opacity-60', className)}>
      {steps.map((s, i) => {
        const complete = done || i < current
        const isCurrent = !canceled && !done && i === current
        return (
          <li key={s.key} className="flex items-center gap-1" aria-current={isCurrent ? 'step' : undefined}>
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 font-medium',
                complete && 'border-transparent bg-muted text-foreground',
                isCurrent && 'border-primary bg-primary/10 text-primary',
                !complete && !isCurrent && 'text-muted-foreground',
              )}
            >
              {complete && <Check className="size-3" aria-hidden="true" />}
              {s.label}
              {complete && <span className="sr-only"> (complete)</span>}
            </span>
            {i < steps.length - 1 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
          </li>
        )
      })}
      {canceled && (
        <li className="ml-2 inline-flex h-6 items-center rounded-full bg-status-canceled/10 px-2.5 font-medium text-status-canceled">Canceled</li>
      )}
    </ol>
  )
}
