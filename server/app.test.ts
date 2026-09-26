import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from './app.ts'

describe('api shell', () => {
  it('reports health', async () => {
    const res = await request(createApp()).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns a JSON error envelope for unknown endpoints', async () => {
    const res = await request(createApp()).get('/api/nope')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
