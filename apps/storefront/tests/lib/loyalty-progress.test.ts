import { describe, expect, it } from 'vitest'

import {
  hasRedemptionsLeft,
  pointsForAmount,
  tierForLifetimePoints,
  tierLabel,
  tierProgress,
} from '@/lib/loyalty-progress'

describe('pointsForAmount', () => {
  it('earns 10 points per dollar, rounded down like the purchase credit', () => {
    expect(pointsForAmount(8.99)).toBe(89)
    expect(pointsForAmount(25)).toBe(250)
  })

  it('earns nothing for zero, negative or non-finite amounts', () => {
    expect(pointsForAmount(0)).toBe(0)
    expect(pointsForAmount(-5)).toBe(0)
    expect(pointsForAmount(Number.NaN)).toBe(0)
  })
})

describe('tierForLifetimePoints', () => {
  it('matches the tier thresholds at their boundaries', () => {
    expect(tierForLifetimePoints(0)).toBe('BRONZE')
    expect(tierForLifetimePoints(499)).toBe('BRONZE')
    expect(tierForLifetimePoints(500)).toBe('SILVER')
    expect(tierForLifetimePoints(1000)).toBe('GOLD')
    expect(tierForLifetimePoints(2500)).toBe('PLATINUM')
  })
})

describe('tierProgress', () => {
  it('reports the points left to the next tier and progress through the band', () => {
    expect(tierProgress(250)).toEqual({ tier: 'BRONZE', nextTier: 'SILVER', pointsToNextTier: 250, percent: 50 })
    expect(tierProgress(750)).toEqual({ tier: 'SILVER', nextTier: 'GOLD', pointsToNextTier: 250, percent: 50 })
  })

  it('has no next tier at Platinum', () => {
    expect(tierProgress(4000)).toEqual({ tier: 'PLATINUM', nextTier: null, pointsToNextTier: 0, percent: 100 })
  })

  it('treats negative lifetime points as zero', () => {
    expect(tierProgress(-10).pointsToNextTier).toBe(500)
  })
})

describe('tierLabel', () => {
  it('title-cases tier names', () => {
    expect(tierLabel('PLATINUM')).toBe('Platinum')
  })
})

describe('hasRedemptionsLeft', () => {
  it('treats a reward with no cap as always available', () => {
    expect(hasRedemptionsLeft({ maxRedemptions: null, usedCount: 10_000 })).toBe(true)
  })

  it('is available while under the cap and not once the cap is reached', () => {
    expect(hasRedemptionsLeft({ maxRedemptions: 5, usedCount: 4 })).toBe(true)
    expect(hasRedemptionsLeft({ maxRedemptions: 5, usedCount: 5 })).toBe(false)
  })
})
