import { describe, expect, it } from 'vitest'

import {
  bucketByMonth,
  bucketCustomerGrowth,
  lastMonths,
  monthKeyOf,
  seriesStart,
} from '@/lib/analytics/monthly-series'

describe('lastMonths', () => {
  it('returns the asked-for number of buckets, oldest first, ending this month', () => {
    const buckets = lastMonths(6, new Date(2026, 7, 9))
    expect(buckets).toHaveLength(6)
    expect(buckets[0].key).toBe('2026-03')
    expect(buckets[5].key).toBe('2026-08')
  })

  it('crosses a year boundary correctly', () => {
    const buckets = lastMonths(3, new Date(2026, 1, 15))
    expect(buckets.map((b) => b.key)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(buckets[0].label).toBe('Dec 2025')
  })

  it('ends each bucket on the real last day of that month', () => {
    const buckets = lastMonths(2, new Date(2026, 1, 15))
    // January has 31 days, February 2026 has 28.
    expect(buckets[0].end.getDate()).toBe(31)
    expect(buckets[1].end.getDate()).toBe(28)
  })

  it('covers a leap February', () => {
    const buckets = lastMonths(1, new Date(2028, 1, 10))
    expect(buckets[0].end.getDate()).toBe(29)
  })
})

describe('seriesStart', () => {
  it('is the start of the oldest bucket', () => {
    const buckets = lastMonths(3, new Date(2026, 7, 9))
    expect(seriesStart(buckets).getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime())
  })
})

describe('bucketByMonth', () => {
  const buckets = lastMonths(3, new Date(2026, 7, 9))

  it('emits a zero for a month with no rows instead of omitting it', () => {
    // The bug in the SQL this replaced: an empty month vanished, so a chart joined the months
    // either side of it and drew a trend that never happened.
    const series = bucketByMonth(
      [{ createdAt: new Date(2026, 5, 10), amount: 100 }],
      buckets
    )
    expect(series).toHaveLength(3)
    expect(series.map((s) => s.total)).toEqual([100, 0, 0])
  })

  it('sums and counts within a month', () => {
    const series = bucketByMonth(
      [
        { createdAt: new Date(2026, 7, 1), amount: 40 },
        { createdAt: new Date(2026, 7, 20), amount: 60 },
      ],
      buckets
    )
    expect(series[2].total).toBe(100)
    expect(series[2].count).toBe(2)
  })

  it('ignores rows outside the window rather than folding them into an edge bucket', () => {
    const series = bucketByMonth(
      [
        { createdAt: new Date(2024, 0, 1), amount: 9999 },
        { createdAt: new Date(2030, 0, 1), amount: 9999 },
      ],
      buckets
    )
    expect(series.every((s) => s.total === 0)).toBe(true)
  })

  it('labels short or long on request', () => {
    const short = bucketByMonth([], buckets, 'short')
    expect(short[0].month).toBe('Jun')
    const long = bucketByMonth([], buckets, 'long')
    expect(long[0].month).toBe('Jun 2026')
  })
})

describe('bucketCustomerGrowth', () => {
  const buckets = lastMonths(3, new Date(2026, 7, 9))

  it('accumulates the running total on top of customers who signed up earlier', () => {
    const series = bucketCustomerGrowth(
      [new Date(2026, 5, 5), new Date(2026, 6, 2), new Date(2026, 6, 9)],
      buckets,
      100
    )
    expect(series.map((s) => s.newCustomers)).toEqual([1, 2, 0])
    // 100 before the window, then cumulative.
    expect(series.map((s) => s.totalCustomers)).toEqual([101, 103, 103])
  })

  it('carries the prior count through a window with no sign-ups at all', () => {
    const series = bucketCustomerGrowth([], buckets, 42)
    expect(series.map((s) => s.totalCustomers)).toEqual([42, 42, 42])
  })

  it('ignores sign-ups outside the window', () => {
    const series = bucketCustomerGrowth([new Date(2020, 0, 1)], buckets, 5)
    expect(series.map((s) => s.newCustomers)).toEqual([0, 0, 0])
  })
})

describe('monthKeyOf', () => {
  it('zero-pads the month so keys sort lexically', () => {
    expect(monthKeyOf(new Date(2026, 0, 15))).toBe('2026-01')
    expect(monthKeyOf(new Date(2026, 10, 15))).toBe('2026-11')
  })
})
