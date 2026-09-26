import { Link } from 'react-router'

import type { Id, Uom } from '@domain/types.ts'
import { qs } from '@/lib/api'
import { formatMoney, formatNumber, uomLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

interface QtyProps {
  value: number
  uom: Uom
  /** When set, the number links to the ledger rows that produced it ("every number is traceable"). */
  trace?: { productId: Id; locationId?: Id; warehouseId?: Id }
  signed?: boolean
  className?: string
}

export function Qty({ value, uom, trace, signed, className }: QtyProps) {
  const text = `${signed && value > 0 ? '+' : ''}${formatNumber(value)}`
  const body = (
    <>
      <span className="tabular-nums">{text}</span> <span className="text-muted-foreground">{uomLabel(uom, value)}</span>
    </>
  )
  if (!trace) return <span className={cn('whitespace-nowrap', className)}>{body}</span>
  return (
    <Link
      to={`/moves${qs(trace)}`}
      onClick={(e) => e.stopPropagation()}
      title="See the moves behind this number"
      className={cn(
        'rounded-sm whitespace-nowrap underline decoration-border decoration-dotted underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {body}
    </Link>
  )
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={cn('tabular-nums whitespace-nowrap', className)}>{formatMoney(value)}</span>
}
