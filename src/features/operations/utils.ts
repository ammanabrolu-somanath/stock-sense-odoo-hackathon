import type { Id } from '@domain/types.ts'
import type { OperationView } from '@domain/api.ts'
import type { DraftLine } from './LineEditor'

type Dated = Pick<OperationView, 'status' | 'scheduledDate'>

export const isOpen = (op: Pick<OperationView, 'status'>) => op.status === 'draft' || op.status === 'waiting' || op.status === 'ready'

/** Same rule the health score uses: open and scheduled before today. */
export const isOverdue = (op: Dated) => isOpen(op) && op.scheduledDate.slice(0, 10) < new Date().toISOString().slice(0, 10)

/** <input type="date"> value ("2026-09-26") → ISO timestamp at 09:00 local time. */
export const dateInputToIso = (value: string) => new Date(`${value}T09:00:00`).toISOString()

/** ISO timestamp → <input type="date"> value in local time. */
export function isoToDateInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Client-side mirror of the server's rules, so problems show before anything is sent. */
export function validateLines(lines: DraftLine[], mode: 'quantity' | 'count'): string | undefined {
  if (lines.length === 0) return 'Add at least one product.'
  if (lines.some((l) => !l.productId)) return 'Choose a product on every line.'
  if (lines.some((l) => l.qty.trim() === '' || !Number.isFinite(Number(l.qty)))) return 'Enter a quantity on every line.'
  if (mode === 'quantity' && lines.some((l) => !(Number(l.qty) > 0))) return 'Quantities must be greater than zero.'
  if (mode === 'count' && lines.some((l) => Number(l.qty) < 0)) return 'Counted quantities cannot be negative.'
  if (mode === 'count' && new Set(lines.map((l) => l.productId)).size !== lines.length) return 'Each product can appear only once in a count.'
  return undefined
}

export const toLinePayload = (lines: DraftLine[]) => lines.map((l) => ({ productId: l.productId as Id, qty: Number(l.qty) }))
