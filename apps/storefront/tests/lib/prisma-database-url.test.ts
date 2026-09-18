import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * Production went down when the database password was rotated: the provider's Vercel integration
 * wrote fresh credentials into POSTGRES_PRISMA_URL/POSTGRES_URL, but the hand-set DATABASE_URL
 * still held the old password and won the precedence check, so every query failed with
 * "Authentication failed against database server".
 */
describe('prisma database URL resolution', () => {
  const KEYS = [
    'DATABASE_URL',
    'POSTGRES_PRISMA_URL',
    'POSTGRES_URL',
    'PRISMA_DATABASE_URL',
  ] as const
  const saved: Partial<Record<(typeof KEYS)[number], string>> = {}

  beforeEach(() => {
    vi.resetModules()
    for (const key of KEYS) {
      if (process.env[key] !== undefined) saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    // Restored key by key rather than with `process.env = { ...saved }`. Assigning
    // a plain object over `process.env` loses Node's own env semantics — notably
    // that writing `undefined` to a key stores the string 'undefined' — and every
    // test after the first would then run against a shim that cannot reproduce the
    // bug the last case here pins.
    for (const key of KEYS) {
      delete process.env[key]
      if (saved[key] !== undefined) process.env[key] = saved[key] as string
      delete saved[key]
    }
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

  it('does not overwrite a good DATABASE_URL with the string "undefined"', async () => {
    // `process.env.X = undefined` stores the six-character string, not nothing —
    // so normalising an absent POSTGRES_URL used to make it truthy, and the
    // precedence check below would then prefer it over a perfectly good
    // DATABASE_URL. Everywhere the managed variables are absent — CI, and any
    // local production build — Prisma was handed 'undefined' and refused it with
    // "the URL must start with the protocol postgresql://".
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/jms_test'

    expect(await load()).toBe('postgresql://postgres:postgres@localhost:5432/jms_test')
    expect(process.env.POSTGRES_URL, 'an absent key must stay absent').toBeUndefined()
    expect('POSTGRES_URL' in process.env, 'the key must be deleted, not stringified').toBe(false)
  })
})
