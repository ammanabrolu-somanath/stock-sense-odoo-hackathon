import { useState } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatMoney, formatMoneyCompact } from '@/lib/format'
import type { SeriesPoint } from './insights'
import { Panel } from './Panel'

/**
 * Two series, one axis, same unit (₹ at cost — summing kg with boxes would be meaningless).
 * Colours are the validated chart tokens; identity is also carried by the legend and a table view.
 */
const config = {
  inbound: { label: 'Received', color: 'var(--chart-1)' },
  outbound: { label: 'Delivered', color: 'var(--chart-2)' },
} satisfies ChartConfig

const day = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const label = (iso: string) => day.format(new Date(`${iso}T00:00:00Z`))

export function MovementChart({ series }: { series: SeriesPoint[] }) {
  const [asTable, setAsTable] = useState(false)
  const totalIn = series.reduce((s, p) => s + p.inbound, 0)
  const totalOut = series.reduce((s, p) => s + p.outbound, 0)

  return (
    <Panel
      title="Stock flow, last 30 days"
      action={
        <Button variant="ghost" size="sm" className="text-muted-foreground" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show chart' : 'Show table'}
        </Button>
      }
    >
      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Value at cost · received {formatMoneyCompact(totalIn)} · delivered {formatMoneyCompact(totalOut)}
      </p>
      {asTable ? (
        <div className="max-h-[260px] overflow-auto px-4 pb-4">
          <table className="mt-2 w-full text-table">
            <caption className="sr-only">Stock flow by day</caption>
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="h-8 text-left font-medium">Day</th>
                <th scope="col" className="h-8 text-right font-medium">Received</th>
                <th scope="col" className="h-8 text-right font-medium">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.date} className="h-8 border-b last:border-0">
                  <td>{label(p.date)}</td>
                  <td className="text-right tabular-nums">{formatMoney(p.inbound)}</td>
                  <td className="text-right tabular-nums">{formatMoney(p.outbound)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-[260px] w-full px-2 pb-2" aria-label="Line chart of value received and delivered per day">
          <LineChart data={series} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={label} />
            <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatMoneyCompact(v)} />
            <ChartTooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={<ChartTooltipContent labelFormatter={(v) => label(String(v))} formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ background: `var(--color-${String(name)})` }} />
                    {config[name as keyof typeof config]?.label}
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                </div>
              )} />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line dataKey="inbound" type="monotone" stroke="var(--color-inbound)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            <Line dataKey="outbound" type="monotone" stroke="var(--color-outbound)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartContainer>
      )}
    </Panel>
  )
}
