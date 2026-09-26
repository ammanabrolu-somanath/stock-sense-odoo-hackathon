import { describe, expect, it } from 'vitest'

import { createContext } from '../context.ts'
import { Db } from './connection.ts'

const count = (db: Db) => db.get<{ n: number }>('SELECT COUNT(*) AS n FROM t')!.n

/** Throws 'cannot start a transaction within a transaction' if one leaked. */
const expectNoOpenTransaction = (db: Db) => {
  expect(() => {
    db.raw.exec('BEGIN')
    db.raw.exec('ROLLBACK')
  }).not.toThrow()
}

function tableDb() {
  const db = new Db(':memory:')
  db.raw.exec('CREATE TABLE t (v INTEGER)')
  return db
}

describe('Db.tx', () => {
  it('commits, and rolls back only the failing savepoint when nested', () => {
    const db = tableDb()
    db.tx(() => {
      db.run('INSERT INTO t VALUES (1)')
      expect(() =>
        db.tx(() => {
          db.run('INSERT INTO t VALUES (2)')
          throw new Error('inner')
        }),
      ).toThrow('inner')
    })
    expect(count(db)).toBe(1)
  })

  it('stays usable after a failed transaction (depth is restored)', () => {
    const db = tableDb()
    expect(() => db.tx(() => { throw new Error('boom') })).toThrow('boom')
    db.tx(() => db.run('INSERT INTO t VALUES (1)'))
    expect(count(db)).toBe(1)
    expectNoOpenTransaction(db)
  })

  it('rejects async callbacks and rolls them back', () => {
    const db = tableDb()
    expect(() =>
      db.tx((async () => {
        db.run('INSERT INTO t VALUES (1)')
      }) as () => unknown),
    ).toThrow(/synchronous/)
    expect(count(db)).toBe(0)
    expectNoOpenTransaction(db)
  })
})

describe('schema guards', () => {
  it('allows only one location per virtual kind', () => {
    const { catalog } = createContext()
    catalog.insertLocation({ warehouseId: null, name: 'Vendors', kind: 'vendor' })
    expect(() => catalog.insertLocation({ warehouseId: null, name: 'Vendors 2', kind: 'vendor' })).toThrow(/UNIQUE/)
  })

  it('refuses an internal location without a warehouse', () => {
    const { catalog } = createContext()
    expect(() => catalog.insertLocation({ warehouseId: null, name: 'Floating shelf', kind: 'internal' })).toThrow(/CHECK/)
  })
})
