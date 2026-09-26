export type DomainErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'INSUFFICIENT_STOCK'
  | 'CONFLICT'

/**
 * Business-rule failure. `message` is written for the end user and shown verbatim in the UI;
 * `details` carries structured data (e.g. shortages) for richer rendering.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details?: unknown

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }
}

export const isDomainError = (e: unknown): e is DomainError => e instanceof DomainError
