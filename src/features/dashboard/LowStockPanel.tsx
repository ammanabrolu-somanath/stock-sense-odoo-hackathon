import { Link, useNavigate } from 'react-router'
import { CircleCheck } from 'lucide-react'
import { toast } from 'sonner'

import type { ProductSummary } from '@domain/api.ts'
import { StockStatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { operationUrl } from '@/features/operations/config'
import { formatNumber, uomLabel } from '@/lib/format'
import { Panel } from './Panel'
import { useReorder } from './insights'

/** Low-stock alerts, each one click from a pre-filled draft receipt (the smart reorder). */
export function LowStockPanel({ total, items }: { total: number; items: ProductSummary[] }) {
  const reorder = useReorder()
  const navigate = useNavigate()

  return (
    <Panel
      title="Low stock alerts"
      action={
        total > items.length ? (
          <Link to="/products?status=low" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            View all {total}
          </Link>
        ) : null
      }
    >
      {items.length === 0 ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-success" aria-hidden="true" />
          Everything is above its reorder minimum.
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link to={`/products/${p.id}`} className="truncate text-sm font-medium hover:underline">
                    {p.name}
                  </Link>
                  <StockStatusBadge status={p.status} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {formatNumber(p.onHand)} {uomLabel(p.uom, p.onHand)} on hand · min {formatNumber(p.reorderMin)}
                  {p.incoming > 0 && ` · ${formatNumber(p.incoming)} incoming`}
                  {p.daysOfCover !== null && ` · ${p.daysOfCover} d cover`}
                </p>
              </div>
              {p.reorder ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reorder.isPending}
                  aria-label={`Reorder ${formatNumber(p.reorder.suggestedQty)} ${uomLabel(p.uom, p.reorder.suggestedQty)} of ${p.name}`}
                  onClick={() =>
                    reorder.mutate(p.id, {
                      onSuccess: (op) => {
                        toast.success(`${op.reference} drafted for ${formatNumber(op.lines[0].qty)} ${uomLabel(p.uom, op.lines[0].qty)} — review and validate`)
                        navigate(operationUrl('receipt', op.id))
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  Reorder {formatNumber(p.reorder.suggestedQty)}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">On order</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
