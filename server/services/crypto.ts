import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'

/** scrypt with a per-password random salt. Format: scrypt$<saltHex>$<hashHex>. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

/** Session tokens and OTP codes are stored only as SHA-256 digests. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function newOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && timingSafeEqual(x, y)
}
