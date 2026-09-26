import { DomainError } from '@domain/errors.ts'
import type { Db } from '../db/connection.ts'
import type { User, UsersRepo } from '../repos/users.repo.ts'
import { hashPassword, newOtpCode, newSessionToken, safeEqualHex, sha256, verifyPassword } from './crypto.ts'
import type { Clock } from './operations.service.ts'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5

export const DEMO_USER = { name: 'Aarav Mehta', email: 'demo@stocksense.in', password: 'demo1234' }

const INVALID_LOGIN = 'Email or password is incorrect.'
const INVALID_CODE = 'That code is invalid or has expired. Request a new one.'

export function createAuthService(deps: { db: Db; users: UsersRepo; now: Clock }) {
  const { db, users, now } = deps
  const iso = (offsetMs = 0) => new Date(now().getTime() + offsetMs).toISOString()

  function startSession(userId: number): { token: string; expiresAt: string } {
    const token = newSessionToken()
    const expiresAt = iso(SESSION_TTL_MS)
    users.purgeExpiredSessions(iso())
    users.insertSession(sha256(token), userId, expiresAt)
    return { token, expiresAt }
  }

  /**
   * Returns the live OTP row when `code` matches; counts failed attempts and burns the code at
   * the limit. Deliberately NOT called inside db.tx: the attempt counter must be committed even
   * though the caller then throws — a rollback would silently reset it and void the limit.
   */
  function checkOtp(email: string, code: string) {
    const otp = users.activeOtp(email, iso())
    if (!otp || otp.attempts >= OTP_MAX_ATTEMPTS) throw new DomainError('VALIDATION', INVALID_CODE)
    if (!safeEqualHex(sha256(code), otp.codeHash)) {
      users.bumpOtpAttempts(otp.id)
      const left = OTP_MAX_ATTEMPTS - otp.attempts - 1
      throw new DomainError(
        'VALIDATION',
        left > 0 ? `That code doesn't match. ${left} attempt${left === 1 ? '' : 's'} left.` : INVALID_CODE,
      )
    }
    return otp
  }

  return {
    signup(input: { name: string; email: string; password: string }): { user: User; token: string; expiresAt: string } {
      return db.tx(() => {
        if (users.findByEmail(input.email)) {
          throw new DomainError('CONFLICT', 'An account with this email already exists. Sign in instead.')
        }
        const id = users.insert({ name: input.name, email: input.email, passwordHash: hashPassword(input.password) }, iso())
        const { passwordHash: _omit, ...user } = users.findByEmail(input.email)!
        return { user: { ...user, id }, ...startSession(id) }
      })
    },

    login(input: { email: string; password: string }): { user: User; token: string; expiresAt: string } {
      const found = users.findByEmail(input.email)
      // Verify against a dummy hash when the user is unknown so timing doesn't reveal existence.
      const ok = verifyPassword(input.password, found?.passwordHash ?? DUMMY_HASH) && !!found
      if (!ok || !found) throw new DomainError('UNAUTHORIZED', INVALID_LOGIN)
      const { passwordHash: _omit, ...user } = found
      return { user, ...db.tx(() => startSession(user.id)) }
    },

    userForToken(token: string | undefined): User | undefined {
      if (!token) return undefined
      return users.userForSession(sha256(token), iso())
    },

    logout(token: string | undefined): void {
      if (token) users.deleteSession(sha256(token))
    },

    /**
     * Issue a 6-digit code. Always succeeds from the caller's point of view (no account
     * enumeration through this endpoint); returns the code only so the demo can display it.
     */
    requestOtp(email: string): { code: string | null } {
      return db.tx(() => {
        users.retireOtps(email, iso())
        if (!users.findByEmail(email)) return { code: null }
        const code = newOtpCode()
        users.insertOtp(email, sha256(code), iso(OTP_TTL_MS))
        return { code }
      })
    },

    verifyOtp(email: string, code: string): void {
      checkOtp(email, code)
    },

    /** Consume the code, set the new password, and sign out every existing session. */
    resetPassword(input: { email: string; code: string; password: string }): void {
      const otp = checkOtp(input.email, input.code)
      db.tx(() => {
        const user = users.findByEmail(input.email)
        if (!user) throw new DomainError('VALIDATION', INVALID_CODE)
        users.useOtp(otp.id, iso())
        users.setPassword(user.id, hashPassword(input.password))
        users.deleteSessionsForUser(user.id)
      })
    },

    ensureUser(u: { name: string; email: string; password: string }): void {
      if (!users.findByEmail(u.email)) users.insert({ name: u.name, email: u.email, passwordHash: hashPassword(u.password) }, iso())
    },
  }
}

const DUMMY_HASH = hashPassword('not-a-real-password')

export type AuthService = ReturnType<typeof createAuthService>
