import type { StockStatus } from '@domain/api.ts'
import type { OperationStatus } from '@domain/types.ts'
import { cn } from '@/lib/utils'

type Tone = 'draft' | 'waiting' | 'ready' | 'done' | 'canceled'

const TONE: Record<Tone, string> = {
  draft: 'text-status-draft bg-status-draft/10',
  waiting: 'text-status-waiting bg-status-waiting/12',
  ready: 'text-status-ready bg-status-ready/10',
  done: 'text-status-done bg-status-done/10',
  canceled: 'text-status-canceled bg-status-canceled/10',
}

function Pill({ tone, children, className }: { tone: Tone; children: string; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap', TONE[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  )
}

const OPERATION_LABEL: Record<OperationStatus, string> = {
  draft: 'Draft',
  waiting: 'Waiting',
  ready: 'Ready',
  done: 'Done',
  canceled: 'Canceled',
}

export function OperationStatusBadge({ status, className }: { status: OperationStatus; className?: string }) {
  return (
    <Pill tone={status} className={className}>
      {OPERATION_LABEL[status]}
    </Pill>
  )
}

const STOCK: Record<StockStatus, { tone: Tone; label: string }> = {
  in_stock: { tone: 'done', label: 'In stock' },
  low: { tone: 'waiting', label: 'Low stock' },
  out: { tone: 'canceled', label: 'Out of stock' },
}

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <Pill tone={STOCK[status].tone} className={className}>
      {STOCK[status].label}
    </Pill>
  )
}
