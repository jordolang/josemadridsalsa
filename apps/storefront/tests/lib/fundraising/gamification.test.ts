import { describe, expect, it } from 'vitest'

import { nextDailyStreak } from '@/lib/fundraising/gamification'

// Instants are UTC; America/New_York is UTC-4 in summer and UTC-5 in winter.
describe('nextDailyStreak', () => {
  it('starts at 1 with no previous login', () => {
    expect(nextDailyStreak(null, new Date('2026-07-01T15:00:00Z'), 0)).toBe(1)
  })

  it('does not change on a second login the same Eastern day', () => {
    // 00:30 ET and 23:30 ET on 2026-07-01 — different UTC days.
    expect(nextDailyStreak(new Date('2026-07-01T04:30:00Z'), new Date('2026-07-02T03:30:00Z'), 3)).toBeNull()
  })

  it('extends on the next Eastern day even within 24h or across midnight UTC', () => {
    // 23:30 ET 2026-07-01 → 00:10 ET 2026-07-02
    expect(nextDailyStreak(new Date('2026-07-02T03:30:00Z'), new Date('2026-07-02T04:10:00Z'), 3)).toBe(4)
  })

  it('does not extend when the UTC date changes but the Eastern date does not', () => {
    // 19:00 ET and 22:00 ET on 2026-07-01 straddle UTC midnight.
    expect(nextDailyStreak(new Date('2026-07-01T23:00:00Z'), new Date('2026-07-02T02:00:00Z'), 2)).toBeNull()
  })

  it('resets to 1 after a missed day', () => {
    expect(nextDailyStreak(new Date('2026-07-01T15:00:00Z'), new Date('2026-07-03T15:00:00Z'), 9)).toBe(1)
  })

  it('counts calendar days across a DST change', () => {
    // 2026-11-01 is the fall-back day (25 hours long).
    expect(nextDailyStreak(new Date('2026-10-31T04:30:00Z'), new Date('2026-11-01T23:00:00Z'), 5)).toBe(6)
  })
})
