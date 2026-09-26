import type { OperationType } from './types.ts'

const PREFIX: Record<OperationType, string> = {
  receipt: 'IN',
  delivery: 'OUT',
  transfer: 'INT',
  adjustment: 'ADJ',
}

/** Sequence key, one counter per warehouse per operation type — e.g. "HYD/IN". */
export function sequenceKey(warehouseCode: string, type: OperationType): string {
  return `${warehouseCode}/${PREFIX[type]}`
}

/** Odoo-style document reference — e.g. "HYD/IN/00042". */
export function formatReference(warehouseCode: string, type: OperationType, n: number): string {
  return `${sequenceKey(warehouseCode, type)}/${String(n).padStart(5, '0')}`
}
