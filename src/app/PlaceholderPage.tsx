import { useMatches } from 'react-router'

import { PageHeader } from '@/components/shared/PageHeader'
import type { RouteHandle } from './Topbar'

/** Temporary route body used until each feature's hour replaces it. */
export function PlaceholderPage({ description }: { description?: string }) {
  const matches = useMatches()
  const title = [...matches].reverse().map((m) => (m.handle as RouteHandle | undefined)?.crumb).find(Boolean) ?? ''
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="grid h-64 place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">
        {title} is being built.
      </div>
    </>
  )
}
