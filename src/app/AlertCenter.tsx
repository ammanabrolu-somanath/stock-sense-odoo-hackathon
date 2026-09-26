import { Link } from 'react-router'
import { Bell } from 'lucide-react'

import { StockStatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useInsights } from '@/features/dashboard/insights'
import { formatNumber, uomLabel } from '@/lib/format'

/** Low-stock alerts, reachable from every page (spec: "Alerts for low stock"). */
export function AlertCenter() {
  const insights = useInsights({})
  const alerts = insights.data?.alerts
  const count = alerts?.total ?? 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative text-muted-foreground" aria-label={count ? `${count} stock alerts` : 'No stock alerts'}>
          <Bell />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-semibold text-background tabular-nums">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Stock alerts</p>
          <Link to="/products?status=low" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            All low stock
          </Link>
        </div>
        {count === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Everything is above its reorder minimum.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {alerts!.items.map((p) => (
              <li key={p.id}>
                <Link to={`/products/${p.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatNumber(p.onHand)} {uomLabel(p.uom, p.onHand)} · min {formatNumber(p.reorderMin)}
                    </span>
                  </span>
                  <StockStatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
