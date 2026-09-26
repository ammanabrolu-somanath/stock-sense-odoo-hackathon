import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from './app.ts'
import { createContext } from './context.ts'

describe('api shell', () => {
  it('reports health with live database counts', async () => {
    const res = await request(createApp(createContext())).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.db).toMatchObject({ warehouses: 0, moves: 0, reconciled: true })
  })

  it('returns a JSON error envelope for unknown endpoints', async () => {
    const res = await request(createApp(createContext())).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
