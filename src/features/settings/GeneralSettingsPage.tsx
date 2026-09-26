import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { FormAlert } from '@/components/shared/FormAlert'
import { PageHeader } from '@/components/shared/PageHeader'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { useResetDemo } from './queries'

export function GeneralSettingsPage() {
  const reset = useResetDemo()

  return (
    <>
      <PageHeader title="General" description="Workspace preferences and demo data." />
      <section className="max-w-2xl rounded-lg border">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-medium">Reset demo data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Restores the seeded inventory: 3 warehouses, their products and 90 days of history. Everything added since is removed. Accounts and your session are kept.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={reset.isPending}>
                <RotateCcw data-icon="inline-start" className={reset.isPending ? 'animate-spin' : undefined} />
                {reset.isPending ? 'Resetting…' : 'Reset demo data'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset all inventory data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Products, documents and the move ledger return to the seeded demo state. This can’t be undone. It takes a few seconds.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my data</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    reset.mutate(undefined, {
                      onSuccess: (r) => toast.success(`Demo data restored — ${formatNumber(r.operations)} documents, ${formatNumber(r.moves)} moves`),
                    })
                  }
                >
                  Reset data
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {reset.error && (
          <div className="border-t p-4">
            <FormAlert message={reset.error.message} />
          </div>
        )}
      </section>
    </>
  )
}
