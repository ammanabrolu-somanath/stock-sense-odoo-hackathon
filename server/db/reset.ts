import type { AppContext } from '../context.ts'
import { DEMO_USER } from '../services/auth.service.ts'
import { dropAll, migrate } from './connection.ts'
import { seedDemo } from './seed.ts'

type Row = Record<string, string | number | null>

/**
 * Restore the demo inventory to its seeded state while keeping accounts and sessions,
 * so whoever pressed "Reset demo data" stays signed in.
 */
export function resetDemo(ctx: AppContext) {
  const { db } = ctx
  const users = db.all<Row>('SELECT id, name, email, password_hash, created_at FROM users')
  const sessions = db.all<Row>('SELECT token_hash, user_id, expires_at FROM sessions')
  dropAll(db)
  migrate(db)
  db.tx(() => {
    for (const u of users) {
      db.run(
        'INSERT INTO users (id, name, email, password_hash, created_at) VALUES (:id, :name, :email, :password_hash, :created_at)',
        u,
      )
    }
    for (const s of sessions) {
      db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (:token_hash, :user_id, :expires_at)', s)
    }
  })
  const summary = seedDemo(ctx)
  ctx.auth.ensureUser(DEMO_USER)
  return summary
}

/** First boot: seed inventory and make sure the demo account exists. */
export function bootstrap(ctx: AppContext): { seeded: boolean } {
  const seeded = ctx.catalog.listWarehouses().length === 0
  if (seeded) seedDemo(ctx)
  ctx.auth.ensureUser(DEMO_USER)
  return { seeded }
}
