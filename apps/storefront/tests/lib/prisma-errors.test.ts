import { describe, it, expect, vi, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'

import {
  isMissingTableError,
  logMissingTableWarning,
} from '@/lib/prisma-errors'

describe('isMissingTableError', () => {
  it('returns true for a Prisma P2021 KnownRequestError', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'The table `public.foo` does not exist in the current database.',
      { code: 'P2021', clientVersion: 'test' },
    )
    expect(isMissingTableError(err)).toBe(true)
  })

  it('returns true for an Accelerate-wrapped Error containing the P2021 code', () => {
    const err = new Error('Server error: P2021 — table `bar` does not exist')
    expect(isMissingTableError(err)).toBe(true)
  })

  it('returns true for the canonical "does not exist in the current database" phrase', () => {
    const err = new Error(
      'The table `public.baz` does not exist in the current database.',
    )
    expect(isMissingTableError(err)).toBe(true)
  })

  it('returns true for a "missing table" message (case-insensitive)', () => {
    const err = new Error('Missing Table for query target')
    expect(isMissingTableError(err)).toBe(true)
  })

  it('returns true when both "relation" and "does not exist" are present', () => {
    const err = new Error('relation "service_credentials" does not exist')
    expect(isMissingTableError(err)).toBe(true)
  })

  it('returns false when only "relation" is present without "does not exist"', () => {
    expect(isMissingTableError(new Error('relation already exists'))).toBe(false)
  })

  it('returns false when only "does not exist" is present without "relation"', () => {
    expect(isMissingTableError(new Error('column does not exist'))).toBe(false)
  })

  it('returns false for a Prisma error with a different code (e.g. P2002 unique violation)', () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' },
    )
    expect(isMissingTableError(err)).toBe(false)
  })

  it('returns false for an unrelated Error', () => {
    expect(isMissingTableError(new Error('connection timeout'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isMissingTableError(null)).toBe(false)
    expect(isMissingTableError(undefined)).toBe(false)
    expect(isMissingTableError('string error')).toBe(false)
    expect(isMissingTableError({ code: 'P2021' })).toBe(false)
    expect(isMissingTableError(42)).toBe(false)
  })
})

describe('logMissingTableWarning', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  afterEach(() => {
    warnSpy.mockClear()
  })

  it('emits a single warning containing the scope, table name, and migration hint', () => {
    logMissingTableWarning('Credentials', 'service_credentials')

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const message = String(warnSpy.mock.calls[0][0])
    expect(message).toContain('[Credentials]')
    expect(message).toContain('service_credentials')
    expect(message).toContain('prisma migrate deploy')
  })

  it('produces a uniformly-formatted message across different scopes/tables (greppable)', () => {
    logMissingTableWarning('RBAC', 'role_permissions')
    logMissingTableWarning('Credentials', 'credential_access_grants')

    const messages = warnSpy.mock.calls.map((call) => String(call[0]))
    for (const msg of messages) {
      expect(msg).toMatch(/^\[\w+\] \w+ table does not exist\. Run `prisma migrate deploy`\.$/)
    }
  })
})
