import { describe, expect, it } from 'vitest'
import { parseDateKey } from '@/lib/waivers/promoReleaseLog'

describe('parseDateKey', () => {
  it('accepts YYYY-MM-DD and the first of repeated params', () => {
    expect(parseDateKey('2026-09-24', '2000-01-01')).toBe('2026-09-24')
    expect(parseDateKey(['2026-09-23', '2026-09-24'], '2000-01-01')).toBe('2026-09-23')
  })

  it('falls back for missing, malformed, or impossible dates', () => {
    for (const value of [undefined, '', '09/24/2026', '2026-9-24', '2026-13-45', '../2026-09-24']) {
      expect(parseDateKey(value, '2000-01-01')).toBe('2000-01-01')
    }
  })
})
