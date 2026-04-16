import { describe, it, expect } from 'vitest'
import {
  SHIELD_DURATION_MS,
  SHIELD_MAX_HP,
  MAX_CONSECUTIVE_SHARES,
  CRIT_DAMAGE_THRESHOLD,
  BIG_PURCHASE_THRESHOLD,
  checkShareAllowed,
  newShield,
  computeDamage,
  applyDamage,
  classifyEmote,
} from '@/lib/arena/rules'

describe('arena/rules — share throttling', () => {
  it('allows a first share from any user', () => {
    const r = checkShareAllowed({
      lastShareUserId: null,
      consecutiveShares: 0,
      incomingUserId: 'alice',
    })
    expect(r).toEqual({ allowed: true, newConsecutive: 1 })
  })

  it('allows a second back-to-back share from the same user', () => {
    const r = checkShareAllowed({
      lastShareUserId: 'alice',
      consecutiveShares: 1,
      incomingUserId: 'alice',
    })
    expect(r).toEqual({ allowed: true, newConsecutive: 2 })
  })

  it('rejects the third back-to-back share from the same user', () => {
    const r = checkShareAllowed({
      lastShareUserId: 'alice',
      consecutiveShares: MAX_CONSECUTIVE_SHARES,
      incomingUserId: 'alice',
    })
    expect(r).toEqual({ allowed: false, reason: 'consecutive_limit' })
  })

  it('resets the counter when a different user shares', () => {
    const r = checkShareAllowed({
      lastShareUserId: 'alice',
      consecutiveShares: MAX_CONSECUTIVE_SHARES,
      incomingUserId: 'bob',
    })
    expect(r).toEqual({ allowed: true, newConsecutive: 1 })
  })
})

describe('arena/rules — shield activation', () => {
  it('sets expiresAt to now + SHIELD_DURATION_MS and seeds full HP', () => {
    const now = new Date('2026-04-16T12:00:00Z')
    const shield = newShield(now)
    expect(shield.activatedAt).toBe(now)
    expect(shield.expiresAt.getTime()).toBe(
      now.getTime() + SHIELD_DURATION_MS,
    )
    expect(shield.remainingHP).toBe(SHIELD_MAX_HP)
  })
})

describe('arena/rules — damage computation', () => {
  const now = new Date('2026-04-16T12:00:00Z')
  const activeShield = (remaining: number) => ({
    expiresAt: new Date(now.getTime() + 10_000),
    remainingHP: remaining,
  })
  const expiredShield = (remaining: number) => ({
    expiresAt: new Date(now.getTime() - 1),
    remainingHP: remaining,
  })

  it('full damage hits HP when there is no shield', () => {
    expect(
      computeDamage({ saleAmount: 45, targetShield: null, now }),
    ).toEqual({ damageToHP: 45, shieldAbsorbed: 0, shieldRemaining: null })
  })

  it('full damage hits HP when shield is expired', () => {
    expect(
      computeDamage({
        saleAmount: 45,
        targetShield: expiredShield(30),
        now,
      }),
    ).toEqual({ damageToHP: 45, shieldAbsorbed: 0, shieldRemaining: 30 })
  })

  it('shield fully absorbs a small hit', () => {
    expect(
      computeDamage({
        saleAmount: 10,
        targetShield: activeShield(30),
        now,
      }),
    ).toEqual({ damageToHP: 0, shieldAbsorbed: 10, shieldRemaining: 20 })
  })

  it('shield absorbs up to remaining HP, overflow hits team HP', () => {
    expect(
      computeDamage({
        saleAmount: 100,
        targetShield: activeShield(30),
        now,
      }),
    ).toEqual({ damageToHP: 70, shieldAbsorbed: 30, shieldRemaining: 0 })
  })

  it('shield with 0 HP absorbs nothing', () => {
    expect(
      computeDamage({
        saleAmount: 25,
        targetShield: activeShield(0),
        now,
      }),
    ).toEqual({ damageToHP: 25, shieldAbsorbed: 0, shieldRemaining: 0 })
  })

  it('floors and clamps negative sale amounts to zero', () => {
    expect(
      computeDamage({ saleAmount: -5, targetShield: null, now }),
    ).toEqual({ damageToHP: 0, shieldAbsorbed: 0, shieldRemaining: null })
  })
})

describe('arena/rules — HP floor', () => {
  it('floors HP at zero on overkill damage', () => {
    expect(applyDamage(10, 100)).toBe(0)
  })
  it('leaves HP unchanged on zero damage', () => {
    expect(applyDamage(50, 0)).toBe(50)
  })
  it('ignores negative damage', () => {
    expect(applyDamage(50, -10)).toBe(50)
  })
})

describe('arena/rules — emote classification', () => {
  it('blocked when shield absorbs and nothing hits HP', () => {
    expect(
      classifyEmote({ saleAmount: 10, damageToHP: 0, shieldAbsorbed: 10 }),
    ).toBe('blocked')
  })
  it('big_purchase when sale meets threshold', () => {
    expect(
      classifyEmote({
        saleAmount: BIG_PURCHASE_THRESHOLD,
        damageToHP: 100,
        shieldAbsorbed: 0,
      }),
    ).toBe('big_purchase')
  })
  it('crit when landed damage meets threshold but sale is below big', () => {
    expect(
      classifyEmote({
        saleAmount: 60,
        damageToHP: CRIT_DAMAGE_THRESHOLD,
        shieldAbsorbed: 0,
      }),
    ).toBe('crit')
  })
  it('normal otherwise', () => {
    expect(
      classifyEmote({ saleAmount: 5, damageToHP: 5, shieldAbsorbed: 0 }),
    ).toBe('normal')
  })
})
