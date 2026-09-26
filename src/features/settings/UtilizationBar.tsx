import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Fill against capacity. Amber from 80%, red from 95% — the only colours carry meaning. */
export function UtilizationBar({ value, capacity, className }: { value: number; capacity: number; className?: string }) {
  const pct = Math.round(value * 100)
  const tone = value >= 0.95 ? 'bg-danger' : value >= 0.8 ? 'bg-warning' : 'bg-primary/70'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 rounded-full bg-muted"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of ${formatNumber(capacity)} units`}
      >
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.max(pct, 1)}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  )
}
