import { CircleAlert } from 'lucide-react'

/** Form-level server error. Announced to screen readers; message comes verbatim from the API. */
export function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
