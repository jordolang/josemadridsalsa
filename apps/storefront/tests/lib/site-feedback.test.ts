import { describe, expect, it } from 'vitest'
import {
  averageRating,
  parseStoredRatings,
  siteFeedbackSchema,
  summarizeByCategory,
} from '@/lib/site-feedback'

describe('siteFeedbackSchema', () => {
  it('accepts ratings for known categories on a 1-10 scale', () => {
    const parsed = siteFeedbackSchema.safeParse({
      ratings: { layout: 9, battleArena: 1, socialSharing: 10 },
      source: 'homepage',
    })
    expect(parsed.success).toBe(true)
  })

  it('accepts a comment with no ratings', () => {
    expect(siteFeedbackSchema.safeParse({ ratings: {}, comment: 'Love it' }).success).toBe(true)
  })

  it('rejects an empty submission', () => {
    expect(siteFeedbackSchema.safeParse({ ratings: {}, comment: '  ' }).success).toBe(false)
  })

  it.each([0, 11, 7.5])('rejects a score of %s', (score) => {
    expect(siteFeedbackSchema.safeParse({ ratings: { layout: score } }).success).toBe(false)
  })

  it('rejects unknown categories', () => {
    expect(siteFeedbackSchema.safeParse({ ratings: { colors: 5 } }).success).toBe(false)
  })

  it('treats a blank email as no email', () => {
    expect(siteFeedbackSchema.safeParse({ ratings: { layout: 5 }, email: '' }).success).toBe(true)
    expect(siteFeedbackSchema.safeParse({ ratings: { layout: 5 }, email: 'nope' }).success).toBe(false)
  })
})

describe('averageRating', () => {
  it('rounds the mean to one decimal', () => {
    expect(averageRating({ layout: 9, accessibility: 8, ordering: 8 })).toBe(8.3)
  })

  it('is null without ratings', () => {
    expect(averageRating({})).toBeNull()
  })
})

describe('parseStoredRatings', () => {
  it('keeps only known categories with valid scores', () => {
    expect(parseStoredRatings({ layout: 7, colors: 5, mobile: 12, ordering: '3' })).toEqual({
      layout: 7,
    })
    expect(parseStoredRatings(null)).toEqual({})
    expect(parseStoredRatings([1, 2])).toEqual({})
  })
})

describe('summarizeByCategory', () => {
  it('reports count and average per category', () => {
    const summary = summarizeByCategory([{ layout: 10, mobile: 4 }, { layout: 7 }, {}])
    expect(summary.find((s) => s.key === 'layout')).toMatchObject({ count: 2, average: 8.5 })
    expect(summary.find((s) => s.key === 'mobile')).toMatchObject({ count: 1, average: 4 })
    expect(summary.find((s) => s.key === 'battleArena')).toMatchObject({ count: 0, average: null })
  })
})
