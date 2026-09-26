import { Db, migrate } from './db/connection.ts'
import { createCatalogRepo } from './repos/catalog.repo.ts'
import { createEventBus } from './routes/events.ts'
import { createOperationsRepo } from './repos/operations.repo.ts'
import { createStockRepo } from './repos/stock.repo.ts'
import { createUsersRepo } from './repos/users.repo.ts'
import { createAnalyticsService } from './services/analytics.service.ts'
import { createAuthService } from './services/auth.service.ts'
import { createDashboardService } from './services/dashboard.service.ts'
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
  const dashboard = createDashboardService({ db, catalog, operations, inventory, now })
  const analytics = createAnalyticsService({ inventory })
  const events = createEventBus()
  return { db, catalog, operations, stock, users, ops, inventory, auth, dashboard, analytics, events, now }
}

export type AppContext = ReturnType<typeof createContext>
