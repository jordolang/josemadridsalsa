import { describe, expect, it } from 'vitest'
import {
  GROUP_CODE_LENGTH,
  GroupCodeSchema,
  PinSchema,
  cleanName,
  displayName,
  generateGroupCode,
  hashPin,
  hashSessionToken,
  isLocked,
  isUnlocked,
  lockAfterFailures,
  newSessionToken,
  verifyPin,
} from '@/lib/fundraiser-app/credentials'

describe('group codes', () => {
  it('generates codes without look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateGroupCode()
      expect(code).toHaveLength(GROUP_CODE_LENGTH)
      expect(code).toMatch(/^[A-Z2-9]+$/)
      expect(code).not.toMatch(/[01OILS5]/)
    }
  })

  it('accepts a code however the seller typed it', () => {
    expect(GroupCodeSchema.parse(' k7q-4mz ')).toBe('K7Q4MZ')
    expect(GroupCodeSchema.safeParse('ab').success).toBe(false)
  })
})

describe('PINs', () => {
  it('are 4 to 6 digits', () => {
    expect(PinSchema.safeParse('1234').success).toBe(true)
    expect(PinSchema.safeParse('123456').success).toBe(true)
    expect(PinSchema.safeParse('123').success).toBe(false)
    expect(PinSchema.safeParse('1234567').success).toBe(false)
    expect(PinSchema.safeParse('12a4').success).toBe(false)
  })

  it('hash and verify', async () => {
    const hash = await hashPin('2468')
    expect(hash).not.toContain('2468')
    expect(await verifyPin('2468', hash)).toBe(true)
    expect(await verifyPin('2469', hash)).toBe(false)
    expect(await verifyPin('2468', null)).toBe(false)
  })
})

describe('names', () => {
  it('are tidied the same way however they were typed', () => {
    expect(cleanName('  mary   ann ')).toBe('Mary Ann')
    expect(displayName('jose', 'madrid')).toBe('Jose Madrid')
  })
})

describe('device tokens', () => {
  it('are long, random and stored only as a hash', () => {
    const token = newSessionToken()
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(newSessionToken()).not.toBe(token)
    expect(hashSessionToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSessionToken(token)).toBe(hashSessionToken(token))
  })
})

describe('lockouts', () => {
  const now = new Date('2026-10-03T12:00:00Z')
  const limit = { maxFailures: 3, lockMinutes: 15 }

  it('starts a lock once the counted failures reach the limit', () => {
    expect(lockAfterFailures(1, limit, now)).toBeNull()
    expect(lockAfterFailures(2, limit, now)).toBeNull()
    expect(lockAfterFailures(3, limit, now)).toEqual(new Date('2026-10-03T12:15:00Z'))
    // Concurrent guesses can push the count past the limit; that still locks.
    expect(lockAfterFailures(7, limit, now)).toEqual(new Date('2026-10-03T12:15:00Z'))
  })

  it('knows when a lock has run out', () => {
    expect(isLocked(null, now)).toBe(false)
    expect(isLocked(new Date('2026-10-03T12:01:00Z'), now)).toBe(true)
    expect(isLocked(new Date('2026-10-03T11:59:00Z'), now)).toBe(false)
  })

  it('keeps the app unlocked for a working day after a correct PIN', () => {
    expect(isUnlocked(null, now)).toBe(false)
    expect(isUnlocked(new Date('2026-10-03T01:00:00Z'), now)).toBe(true)
    expect(isUnlocked(new Date('2026-10-02T23:00:00Z'), now)).toBe(false)
  })
})
