import { Link } from 'react-router'
import { formatDistanceToNowStrict } from 'date-fns'

import type { WarehouseSummary } from '@domain/api.ts'
import { OPERATION_CONFIG, operationUrl } from '@/features/operations/config'
import { UtilizationBar } from '@/features/settings/UtilizationBar'
import { formatNumber } from '@/lib/format'
import type { DashboardInsights } from './insights'
import { Panel } from './Panel'

export function WarehouseUtilization({ warehouses }: { warehouses: WarehouseSummary[] }) {
  return (
    <Panel title="Warehouse utilization">
      <ul className="grid gap-3 p-4">
        {warehouses.map((w) => (
          <li key={w.id}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <Link to={`/settings/warehouses/${w.id}`} className="hover:underline">
                <span className="font-mono text-xs text-muted-foreground">{w.code}</span> {w.name}
              </Link>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatNumber(w.onHand)} / {formatNumber(w.capacityUnits)}
              </span>
            </div>
            <UtilizationBar value={w.utilization} capacity={w.capacityUnits} />
          </li>
        ))}
      </ul>
    </Panel>
  )
}

export function ActivityFeed({ items }: { items: DashboardInsights['activity'] }) {
  return (
    <Panel title="Recent activity" action={<Link to="/moves" className="text-xs text-muted-foreground hover:text-foreground hover:underline">Move History</Link>}>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nothing validated yet.</p>
      ) : (
        <ol className="divide-y">
          {items.map((a) => (
            <li key={a.id} className="flex items-baseline gap-3 px-4 py-2 text-sm">
              <Link to={operationUrl(a.type, a.id)} className="font-mono text-xs hover:underline">
                {a.reference}
              </Link>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {OPERATION_CONFIG[a.type].label}
                {a.partner ? ` · ${a.partner}` : ''}
              </span>
              <time dateTime={a.doneAt} className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNowStrict(new Date(a.doneAt), { addSuffix: true })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
