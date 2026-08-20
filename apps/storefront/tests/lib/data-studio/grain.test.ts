import { describe, it, expect } from 'vitest'

import {
  BUSINESS_TIMEZONE,
  UNKNOWN_BUCKET_KEY,
  bucketKeyOf,
  bucketLabel,
  bucketsBetween,
  formatIsoDate,
  parseIsoDate,
  rangeBounds,
  yearBucketKey,
  yearBucketsBetween,
} from '@/lib/data-studio/grain'

describe('data-studio grain', () => {
  it('reads the business timezone, not UTC', () => {
    expect(BUSINESS_TIMEZONE).toBe('America/New_York')
  })

  describe('tax-year correctness', () => {
    // The defect this module exists to prevent. 8pm ET on 31 Dec is 01:00 UTC on 1 Jan; bucketed in
    // UTC the sale lands in the following tax year.
    const lateNewYearsEve = new Date('2026-01-01T01:00:00.000Z')

    it('buckets a 31 Dec 8pm ET instant into that December, not January', () => {
      expect(bucketKeyOf(lateNewYearsEve, 'day')).toBe('2025-12-31')
      expect(bucketKeyOf(lateNewYearsEve, 'month')).toBe('2025-12')
      expect(bucketKeyOf(lateNewYearsEve, 'quarter')).toBe('2025-Q4')
      expect(bucketKeyOf(lateNewYearsEve, 'year')).toBe('2025')
    })

    it('still buckets a genuine 1 Jan ET instant into January', () => {
      const newYearsDay = new Date('2026-01-01T15:00:00.000Z') // 10am ET
      expect(bucketKeyOf(newYearsDay, 'day')).toBe('2026-01-01')
      expect(bucketKeyOf(newYearsDay, 'year')).toBe('2026')
    })

    it('handles the spring-forward boundary without shifting the day', () => {
      // 2026-03-08 is the US DST transition. 3am ET that morning is 07:00 UTC.
      expect(bucketKeyOf(new Date('2026-03-08T07:00:00.000Z'), 'day')).toBe('2026-03-08')
    })
  })

  describe('grain keys sort chronologically', () => {
    it('orders month keys lexicographically', () => {
      const keys = ['2026-01', '2025-12', '2025-02'].sort()
      expect(keys).toEqual(['2025-02', '2025-12', '2026-01'])
    })

    it('orders quarter keys lexicographically', () => {
      const keys = ['2025-Q4', '2025-Q1', '2026-Q1'].sort()
      expect(keys).toEqual(['2025-Q1', '2025-Q4', '2026-Q1'])
    })
  })

  describe('weeks start on Monday', () => {
    it('maps a Wednesday back to its Monday', () => {
      // 2026-08-19 is a Wednesday; its week began Monday the 17th.
      expect(bucketKeyOf(new Date('2026-08-19T16:00:00.000Z'), 'week')).toBe('2026-08-17')
    })

    it('maps a Sunday back to the Monday six days earlier, not the next day', () => {
      // 2026-08-23 is a Sunday. Noon ET keeps it clear of the day boundary.
      expect(bucketKeyOf(new Date('2026-08-23T16:00:00.000Z'), 'week')).toBe('2026-08-17')
    })
  })

  describe('null dates', () => {
    it('routes a null date to the unknown bucket rather than dropping it', () => {
      expect(bucketKeyOf(null, 'month')).toBe(UNKNOWN_BUCKET_KEY)
      expect(bucketKeyOf(undefined, 'year')).toBe(UNKNOWN_BUCKET_KEY)
      expect(yearBucketKey(null)).toBe(UNKNOWN_BUCKET_KEY)
    })

    it('labels the unknown bucket legibly', () => {
      expect(bucketLabel(UNKNOWN_BUCKET_KEY, 'month')).toBe('Unknown')
    })
  })

  describe('parseIsoDate', () => {
    it('accepts a real date', () => {
      expect(parseIsoDate('2026-02-28')).toEqual({ year: 2026, month: 2, day: 28 })
    })

    it('rejects a rollover date instead of silently advancing the month', () => {
      expect(parseIsoDate('2026-02-30')).toBeNull()
      expect(parseIsoDate('2026-13-01')).toBeNull()
      expect(parseIsoDate('not-a-date')).toBeNull()
    })

    it('round-trips through formatIsoDate', () => {
      expect(formatIsoDate({ year: 2026, month: 3, day: 9 })).toBe('2026-03-09')
    })
  })

  describe('bucketsBetween emits every bucket, zeros included', () => {
    it('spans months across a year boundary with no gaps', () => {
      const buckets = bucketsBetween(
        { year: 2025, month: 11, day: 14 },
        { year: 2026, month: 2, day: 3 },
        'month'
      )
      expect(buckets.map((b) => b.key)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    })

    it('spans quarters across a year boundary', () => {
      const buckets = bucketsBetween(
        { year: 2025, month: 8, day: 1 },
        { year: 2026, month: 4, day: 1 },
        'quarter'
      )
      expect(buckets.map((b) => b.key)).toEqual(['2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'])
    })

    it('spans days inclusively at both ends', () => {
      const buckets = bucketsBetween(
        { year: 2026, month: 2, day: 27 },
        { year: 2026, month: 3, day: 2 },
        'day'
      )
      expect(buckets.map((b) => b.key)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
    })

    it('spans years', () => {
      const buckets = bucketsBetween(
        { year: 2019, month: 6, day: 5 },
        { year: 2022, month: 1, day: 1 },
        'year'
      )
      expect(buckets.map((b) => b.key)).toEqual(['2019', '2020', '2021', '2022'])
    })

    it('returns a single bucket when both ends fall inside one', () => {
      const buckets = bucketsBetween(
        { year: 2026, month: 5, day: 2 },
        { year: 2026, month: 5, day: 28 },
        'month'
      )
      expect(buckets.map((b) => b.key)).toEqual(['2026-05'])
    })
  })

  describe('yearBucketsBetween', () => {
    it('covers the archive span inclusively', () => {
      expect(yearBucketsBetween(2011, 2014).map((b) => b.key)).toEqual(['2011', '2012', '2013', '2014'])
    })
  })

  describe('rangeBounds', () => {
    it('covers whole business-local days at both ends', () => {
      const { start, end } = rangeBounds({ year: 2026, month: 1, day: 1 }, { year: 2026, month: 1, day: 31 })
      // Midnight ET on 1 Jan is 05:00 UTC (EST); the last instant of 31 Jan is 04:59:59.999 on 1 Feb.
      expect(start.toISOString()).toBe('2026-01-01T05:00:00.000Z')
      expect(end.toISOString()).toBe('2026-02-01T04:59:59.999Z')
    })
  })

  describe('labels', () => {
    it('formats month, quarter and year labels for an axis', () => {
      expect(bucketLabel('2025-12', 'month')).toBe('Dec 2025')
      expect(bucketLabel('2025-Q3', 'quarter')).toBe('2025 Q3')
      expect(bucketLabel('2025', 'year')).toBe('2025')
      expect(bucketLabel('2026-08-17', 'week')).toBe('Week of Aug 17')
      expect(bucketLabel('2026-08-19', 'day')).toBe('Aug 19')
    })
  })
})
