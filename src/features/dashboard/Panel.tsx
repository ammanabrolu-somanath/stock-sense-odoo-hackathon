import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** A titled, bordered section — the dashboard's only container (no shadows, no gradients). */
export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  const id = `panel-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section aria-labelledby={id} className={cn('rounded-lg border', className)}>
      <header className="flex h-11 items-center justify-between gap-2 border-b px-4">
        <h2 id={id} className="text-sm font-medium">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}
