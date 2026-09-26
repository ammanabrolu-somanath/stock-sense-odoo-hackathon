import { DomainError } from './errors.ts'
import type { Operation, OperationStatus, OperationType } from './types.ts'

export type OperationAction = 'edit' | 'confirm' | 'check' | 'pick' | 'pack' | 'validate' | 'cancel'

/** Statuses from which each action is allowed. */
const ALLOWED: Record<OperationAction, readonly OperationStatus[]> = {
  edit: ['draft'],
  confirm: ['draft'],
  check: ['waiting', 'ready'],
  pick: ['ready'],
  pack: ['ready'],
  validate: ['draft', 'waiting', 'ready'],
  cancel: ['draft', 'waiting', 'ready'],
}

const VERB: Record<OperationAction, string> = {
  edit: 'edited',
  confirm: 'confirmed',
  check: 'checked for availability',
  pick: 'picked',
  pack: 'packed',
  validate: 'validated',
  cancel: 'canceled',
}

/** Deliveries and transfers take stock out of an internal location, so they need it to exist. */
export function needsAvailability(type: OperationType): boolean {
  return type === 'delivery' || type === 'transfer'
}

/** Only deliveries go through pick → pack before validation (per the problem statement). */
export function usesPickPack(type: OperationType): boolean {
  return type === 'delivery'
}

export function assertCan(action: OperationAction, op: Pick<Operation, 'status' | 'type' | 'reference'>): void {
  if (!ALLOWED[action].includes(op.status)) {
    const why =
      op.status === 'done'
        ? 'it is already done — done documents are immutable; post an adjustment to correct stock'
        : `it is ${op.status}`
    throw new DomainError('INVALID_STATE', `${op.reference} can't be ${VERB[action]} because ${why}.`)
  }
  if ((action === 'pick' || action === 'pack') && !usesPickPack(op.type)) {
    throw new DomainError('INVALID_STATE', `Only deliveries are picked and packed.`)
  }
}

/** Status a confirmed document lands in, given whether its source can cover it. */
export function statusAfterAvailability(type: OperationType, hasShortage: boolean): OperationStatus {
  if (!needsAvailability(type)) return 'ready'
  return hasShortage ? 'waiting' : 'ready'
}

/** Deliveries must be fully picked and packed before they can leave. */
export function assertShippable(op: Pick<Operation, 'type' | 'reference' | 'packedAt' | 'lines'>): void {
  if (!usesPickPack(op.type)) return
  const unpicked = op.lines.filter((l) => !l.picked).length
  if (unpicked > 0) {
    throw new DomainError(
      'INVALID_STATE',
      `${op.reference} has ${unpicked} line${unpicked === 1 ? '' : 's'} not picked yet. Pick all items, then pack.`,
    )
  }
  if (!op.packedAt) {
    throw new DomainError('INVALID_STATE', `${op.reference} is picked but not packed. Pack it before validating.`)
  }
}

export function assertHasLines(op: Pick<Operation, 'type' | 'lines' | 'reference'>): void {
  if (op.lines.length === 0) {
    throw new DomainError('VALIDATION', `${op.reference} has no product lines.`)
  }
  if (op.type !== 'adjustment' && op.lines.some((l) => !(l.qty > 0))) {
    throw new DomainError('VALIDATION', 'Every line needs a quantity greater than zero.')
  }
  if (op.type === 'adjustment' && op.lines.some((l) => !(l.qty >= 0))) {
    throw new DomainError('VALIDATION', 'Counted quantities cannot be negative.')
  }
  if (op.type === 'adjustment' && new Set(op.lines.map((l) => l.productId)).size !== op.lines.length) {
    // A count records one number per product; duplicates would make the recorded-vs-counted audit ambiguous.
    throw new DomainError('VALIDATION', 'Each product can appear only once in a count.')
  }
}
