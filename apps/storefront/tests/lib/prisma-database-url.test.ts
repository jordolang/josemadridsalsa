import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Production went down when the database password was rotated: the provider's Vercel integration
 * wrote fresh credentials into POSTGRES_PRISMA_URL/POSTGRES_URL, but the hand-set DATABASE_URL
 * still held the old password and won the precedence check, so every query failed with
 * "Authentication failed against database server".
 */
describe('prisma database URL resolution', () => {
  const saved = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    delete process.env.DATABASE_URL
    delete process.env.POSTGRES_PRISMA_URL
    delete process.env.POSTGRES_URL
    delete process.env.PRISMA_DATABASE_URL
  })

  afterEach(() => {
    process.env = { ...saved }
  })

  const load = async () => {
    const { resolveDatabaseUrl } = await import('@/lib/prisma')
    return resolveDatabaseUrl()
  }

  it('prefers the provider-managed URL over a stale hand-set DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'postgresql://user:stale@host/db'
    process.env.POSTGRES_PRISMA_URL = 'postgresql://user:current@host/db'

    expect(await load()).toBe('postgresql://user:current@host/db')
  })

  it('falls back to POSTGRES_URL when POSTGRES_PRISMA_URL is absent', async () => {
    process.env.DATABASE_URL = 'postgresql://user:stale@host/db'
    process.env.POSTGRES_URL = 'postgresql://user:current@host/db'

    expect(await load()).toBe('postgresql://user:current@host/db')
  })

  it('keeps DATABASE_URL when no managed URL is present', async () => {
    process.env.DATABASE_URL = 'postgresql://user:only@host/db'

    expect(await load()).toBe('postgresql://user:only@host/db')
  })

  it('trims whitespace pasted into the environment value', async () => {
    process.env.POSTGRES_PRISMA_URL = '  postgresql://user:current@host/db\n'

    expect(await load()).toBe('postgresql://user:current@host/db')
  })
})
