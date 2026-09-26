import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import { schemaSql, SCHEMA_VERSION } from './schema.ts'

export type Params = Record<string, SQLInputValue>

/**
 * Thin wrapper over node:sqlite: typed query helpers and nested transactions via savepoints.
 * node:sqlite has no transaction helper, so `tx` provides one.
 */
export class Db {
  readonly raw: DatabaseSync
  private depth = 0

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
    this.raw = new DatabaseSync(file)
    this.raw.exec('PRAGMA foreign_keys = ON;')
    if (file !== ':memory:') this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;')
  }

  all<T>(sql: string, params: Params = {}): T[] {
    return this.raw.prepare(sql).all(params) as T[]
  }

  get<T>(sql: string, params: Params = {}): T | undefined {
    return this.raw.prepare(sql).get(params) as T | undefined
  }

  run(sql: string, params: Params = {}): { id: number; changes: number } {
    const r = this.raw.prepare(sql).run(params)
    return { id: Number(r.lastInsertRowid), changes: Number(r.changes) }
  }

  /**
   * Run `fn` atomically. Nested calls become savepoints, so services can compose.
   * `fn` must be synchronous: the depth counter is only safe because Node never preempts
   * synchronous code. An async callback would let another request interleave inside the
   * transaction, so it is rejected (and rolled back) rather than silently corrupting scope.
   */
  tx<T>(fn: () => T): T {
    const depth = this.depth
    const sp = `sp_${depth}`
    this.raw.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${sp}`)
    this.depth = depth + 1
    try {
      const result = fn()
      if (result instanceof Promise) {
        result.catch(() => {})
        throw new Error('Db.tx callback must be synchronous')
      }
      this.raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`)
      return result
    } catch (e) {
      // Also reached when COMMIT/RELEASE itself fails (e.g. SQLITE_BUSY): undo at *this* level.
      try {
        this.raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`)
      } catch {
        // Rollback failure (e.g. SQLite already rolled back) must not mask the original error.
      }
      throw e
    } finally {
      this.depth = depth
    }
  }

  close() {
    this.raw.close()
  }
}

function schemaVersion(db: Db): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0
}

/** Create the schema on an empty database. Returns true if it was freshly created. */
export function migrate(db: Db): boolean {
  if (schemaVersion(db) >= SCHEMA_VERSION) return false
  db.tx(() => {
    db.raw.exec(schemaSql)
    db.raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
  })
  return true
}

/** Drop everything (demo reset). Triggers don't fire on DROP TABLE, so the ledger guard is intact otherwise. */
export function dropAll(db: Db): void {
  const objects = db.all<{ type: string; name: string }>(
    "SELECT type, name FROM sqlite_master WHERE type IN ('view','table') AND name NOT LIKE 'sqlite_%'",
  )
  db.raw.exec('PRAGMA foreign_keys = OFF;')
  try {
    db.tx(() => {
      for (const o of objects.filter((x) => x.type === 'view')) db.raw.exec(`DROP VIEW IF EXISTS "${o.name}"`)
      for (const o of objects.filter((x) => x.type === 'table')) db.raw.exec(`DROP TABLE IF EXISTS "${o.name}"`)
      db.raw.exec('PRAGMA user_version = 0')
    })
  } finally {
    db.raw.exec('PRAGMA foreign_keys = ON;')
  }
}
