import { Db, migrate } from './db/connection.ts'
import { createCatalogRepo } from './repos/catalog.repo.ts'
import { createOperationsRepo } from './repos/operations.repo.ts'
import { createStockRepo } from './repos/stock.repo.ts'
import { createUsersRepo } from './repos/users.repo.ts'
import { createAuthService } from './services/auth.service.ts'
import { createInventoryService } from './services/inventory.service.ts'
import { createOperationsService, type Clock } from './services/operations.service.ts'

/** Composition root: one DB, its repos and services. Tests build one per case on ':memory:'. */
export function createContext(opts: { file?: string; now?: Clock } = {}) {
  const db = new Db(opts.file ?? ':memory:')
  migrate(db)
  const now = opts.now ?? (() => new Date())
  const catalog = createCatalogRepo(db)
  const operations = createOperationsRepo(db)
  const stock = createStockRepo(db)
  const users = createUsersRepo(db)
  const ops = createOperationsService({ db, catalog, operations, stock, now })
  const inventory = createInventoryService({ db, catalog, operations, stock, ops, now })
  const auth = createAuthService({ db, users, now })
  return { db, catalog, operations, stock, users, ops, inventory, auth, now }
}

export type AppContext = ReturnType<typeof createContext>
