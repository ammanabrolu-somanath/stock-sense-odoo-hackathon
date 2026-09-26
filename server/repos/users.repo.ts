import type { Id } from '@domain/types.ts'
import type { Db } from '../db/connection.ts'

export interface User {
  id: Id
  name: string
  email: string
  createdAt: string
}

type UserWithHash = User & { passwordHash: string }

const USER_COLUMNS = 'u.id, u.name, u.email, u.created_at AS createdAt'

/** SQL for users, sessions and password OTPs. No business rules here. */
export function createUsersRepo(db: Db) {
  return {
    insert(u: { name: string; email: string; passwordHash: string }, createdAt: string): Id {
      return db.run(
        'INSERT INTO users (name, email, password_hash, created_at) VALUES (:name, :email, :passwordHash, :createdAt)',
        { ...u, createdAt },
      ).id
    },
    findByEmail(email: string): UserWithHash | undefined {
      return db.get(`SELECT ${USER_COLUMNS}, u.password_hash AS passwordHash FROM users u WHERE u.email = :email`, { email })
    },
    setPassword(id: Id, passwordHash: string): void {
      db.run('UPDATE users SET password_hash = :passwordHash WHERE id = :id', { id, passwordHash })
    },

    insertSession(tokenHash: string, userId: Id, expiresAt: string): void {
      db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (:tokenHash, :userId, :expiresAt)', {
        tokenHash,
        userId,
        expiresAt,
      })
    },
    userForSession(tokenHash: string, now: string): User | undefined {
      return db.get(
        `SELECT ${USER_COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = :tokenHash AND s.expires_at > :now`,
        { tokenHash, now },
      )
    },
    deleteSession(tokenHash: string): void {
      db.run('DELETE FROM sessions WHERE token_hash = :tokenHash', { tokenHash })
    },
    deleteSessionsForUser(userId: Id): void {
      db.run('DELETE FROM sessions WHERE user_id = :userId', { userId })
    },
    purgeExpiredSessions(now: string): void {
      db.run('DELETE FROM sessions WHERE expires_at <= :now', { now })
    },

    insertOtp(email: string, codeHash: string, expiresAt: string): void {
      db.run('INSERT INTO password_otps (email, code_hash, expires_at) VALUES (:email, :codeHash, :expiresAt)', {
        email,
        codeHash,
        expiresAt,
      })
    },
    /** Invalidate every outstanding code for an email (a new request supersedes old ones). */
    retireOtps(email: string, now: string): void {
      db.run('UPDATE password_otps SET used_at = :now WHERE email = :email AND used_at IS NULL', { email, now })
    },
    activeOtp(email: string, now: string): { id: Id; codeHash: string; attempts: number } | undefined {
      return db.get(
        `SELECT id, code_hash AS codeHash, attempts FROM password_otps
         WHERE email = :email AND used_at IS NULL AND expires_at > :now ORDER BY id DESC LIMIT 1`,
        { email, now },
      )
    },
    bumpOtpAttempts(id: Id): void {
      db.run('UPDATE password_otps SET attempts = attempts + 1 WHERE id = :id', { id })
    },
    useOtp(id: Id, now: string): void {
      db.run('UPDATE password_otps SET used_at = :now WHERE id = :id', { id, now })
    },
  }
}

export type UsersRepo = ReturnType<typeof createUsersRepo>
