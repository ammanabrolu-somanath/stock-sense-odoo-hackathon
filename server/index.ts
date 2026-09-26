import { createApp } from './app.ts'
import { createContext } from './context.ts'
import { bootstrap } from './db/reset.ts'

const port = Number(process.env.PORT ?? 3001)
const ctx = createContext({ file: process.env.DB_PATH ?? 'data/stocksense.db' })

const t0 = performance.now()
if (bootstrap(ctx).seeded) {
  console.log(`[api] seeded demo data in ${Math.round(performance.now() - t0)} ms`)
}

createApp(ctx).listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`)
})
