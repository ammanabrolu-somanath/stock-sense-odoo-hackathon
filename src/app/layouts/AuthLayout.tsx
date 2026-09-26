import { Outlet } from 'react-router'

import { Logo } from '../Logo'

/**
 * Split layout: form on the left, a quiet factual panel on the right
 * (what the product does — no illustration, no gradient).
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </main>
        <p className="text-xs text-muted-foreground">Demo environment · data resets on request</p>
      </div>
      <aside className="hidden border-l bg-sidebar lg:flex lg:flex-col lg:justify-center lg:px-14">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Every unit, accounted for</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
          Receipts, deliveries, transfers and counts in one ledger you can trust.
        </h2>
        <dl className="mt-10 grid gap-6 text-sm">
          {[
            ['Traceable stock', 'On-hand quantities are derived from the move ledger — click any number to see why.'],
            ['Odoo-style operations', 'Draft → Waiting → Ready → Done, with availability checks before anything ships.'],
            ['Multi-warehouse', 'Racks, production floors and warehouses across cities, tracked per location.'],
          ].map(([t, d]) => (
            <div key={t} className="border-l-2 border-border pl-4">
              <dt className="font-medium">{t}</dt>
              <dd className="mt-1 text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  )
}
