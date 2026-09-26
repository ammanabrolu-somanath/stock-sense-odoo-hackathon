import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid h-[60vh] place-items-center text-center">
      <div>
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">This page doesn't exist</h1>
        <p className="mt-1 text-sm text-muted-foreground">The link may be outdated, or the record was removed.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
