import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, type LucideIcon } from 'lucide-react'

import type { OperationType } from '@domain/types.ts'

/**
 * One engine, four document types. The config holds only what genuinely differs:
 * labels, which locations the user chooses, and how lines are read. Behaviour
 * (lifecycle, availability, ledger posting) lives in the shared domain and API.
 */
export interface OperationConfig {
  type: OperationType
  path: string
  label: string
  plural: string
  description: string
  icon: LucideIcon
  /** Supplier / customer field, or none. */
  partner: { label: string; placeholder: string } | null
  /** Which internal locations the user picks. Virtual endpoints are implied. */
  source: { label: string } | null
  dest: { label: string } | null
  /** Where "available" is measured (the location stock leaves from, or the counted shelf). */
  availableAt: 'source' | 'dest' | null
  qtyLabel: string
  /** Primary action name on Validate. */
  validateLabel: string
  emptyTitle: string
}

export const OPERATION_CONFIG: Record<OperationType, OperationConfig> = {
  receipt: {
    type: 'receipt',
    path: 'receipts',
    label: 'Receipt',
    plural: 'Receipts',
    description: 'Incoming goods from vendors. Validating adds the stock.',
    icon: ArrowDownToLine,
    partner: { label: 'Supplier', placeholder: 'e.g. Tata Steel Distributors' },
    source: null,
    dest: { label: 'Receive into' },
    availableAt: null,
    qtyLabel: 'Quantity',
    validateLabel: 'Validate receipt',
    emptyTitle: 'No receipts',
  },
  delivery: {
    type: 'delivery',
    path: 'deliveries',
    label: 'Delivery',
    plural: 'Deliveries',
    description: 'Outgoing goods to customers — pick, pack, then validate to remove the stock.',
    icon: ArrowUpFromLine,
    partner: { label: 'Customer', placeholder: 'e.g. L&T Construction' },
    source: { label: 'Ship from' },
    dest: null,
    availableAt: 'source',
    qtyLabel: 'Quantity',
    validateLabel: 'Validate delivery',
    emptyTitle: 'No deliveries',
  },
  transfer: {
    type: 'transfer',
    path: 'transfers',
    label: 'Transfer',
    plural: 'Transfers',
    description: 'Move stock between warehouses, racks and production floors. Totals stay the same.',
    icon: ArrowLeftRight,
    partner: null,
    source: { label: 'From' },
    dest: { label: 'To' },
    availableAt: 'source',
    qtyLabel: 'Quantity',
    validateLabel: 'Validate transfer',
    emptyTitle: 'No transfers',
  },
  adjustment: {
    type: 'adjustment',
    path: 'adjustments',
    label: 'Adjustment',
    plural: 'Adjustments',
    description: 'Reconcile recorded stock with a physical count. Only the difference is posted.',
    icon: ClipboardCheck,
    partner: null,
    source: null,
    dest: { label: 'Counted location' },
    availableAt: 'dest',
    qtyLabel: 'Counted',
    validateLabel: 'Apply count',
    emptyTitle: 'No adjustments',
  },
}

export const OPERATION_TYPES_BY_PATH = Object.fromEntries(Object.values(OPERATION_CONFIG).map((c) => [c.path, c])) as Record<
  string,
  OperationConfig
>

export const operationUrl = (type: OperationType, id?: number | 'new') =>
  `/operations/${OPERATION_CONFIG[type].path}${id === undefined ? '' : `/${id}`}`
