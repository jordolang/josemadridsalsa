import { describe, expect, it } from 'vitest'

import {
  classifyQuery,
  digitsOnly,
  groupResults,
  isSearchable,
  MATCH_SCORES,
  rankResults,
  scoreTextMatch,
  searchTargets,
  type SearchResult,
} from '@/lib/admin/global-search'

const result = (over: Partial<SearchResult>): SearchResult => ({
  entity: 'order',
  id: 'x',
  title: 'x',
  href: '/admin/orders/x',
  score: 0,
  ...over,
})

describe('classifyQuery', () => {
  it('recognises an order number', () => {
    expect(classifyQuery('JMS-20260807-1234')).toBe('order-number')
    expect(classifyQuery('jms-20260807-1234')).toBe('order-number')
  })

  it('recognises an RMA number', () => {
    expect(classifyQuery('RMA-20260807-5897')).toBe('rma-number')
  })

  it('distinguishes an RMA from an order number', () => {
    // Both share a shape; the prefix is what separates them, and getting it wrong sends
    // the operator to the wrong entity entirely.
    expect(classifyQuery('RMA-20260807-1234')).not.toBe('order-number')
    expect(classifyQuery('JMS-20260807-1234')).not.toBe('rma-number')
  })

  it('recognises an email', () => {
    expect(classifyQuery('someone@example.com')).toBe('email')
  })

  it('recognises a SKU', () => {
    expect(classifyQuery('JMS-HOT-001')).toBe('sku')
  })

  it('recognises a carrier tracking number', () => {
    expect(classifyQuery('1Z999AA10123456784')).toBe('tracking')
  })

  it('recognises a phone number through its separators', () => {
    expect(classifyQuery('(740) 555-0132')).toBe('phone')
    expect(classifyQuery('+1 740 555 0132')).toBe('phone')
  })

  it('does not mistake a short number for a phone number', () => {
    expect(classifyQuery('12345')).toBe('text')
  })

  it('falls back to text for a name', () => {
    expect(classifyQuery('Sanchez')).toBe('text')
    expect(classifyQuery('hot salsa')).toBe('text')
  })

  it('ignores surrounding whitespace', () => {
    expect(classifyQuery('  JMS-20260807-1234  ')).toBe('order-number')
  })
})

describe('digitsOnly', () => {
  it('strips phone formatting', () => {
    expect(digitsOnly('+1 (740) 555-0132')).toBe('17405550132')
  })
})

describe('searchTargets', () => {
  it('goes straight to orders for an order number', () => {
    // Pasting an order number should not also scan products and customers.
    expect(searchTargets('order-number')).toEqual(['order'])
  })

  it('goes straight to returns for an RMA', () => {
    expect(searchTargets('rma-number')).toEqual(['return'])
  })

  it('searches everything for free text', () => {
    expect(searchTargets('text')).toEqual(
      expect.arrayContaining(['order', 'customer', 'product', 'fundraiser', 'discount', 'return'])
    )
  })

  it('does not scan products for an email', () => {
    expect(searchTargets('email')).not.toContain('product')
  })
})

describe('scoreTextMatch', () => {
  it('ranks exact above prefix above substring', () => {
    expect(scoreTextMatch('Hot Salsa', 'hot salsa')).toBe(MATCH_SCORES.exactIdentifier)
    expect(scoreTextMatch('Hot Salsa', 'hot')).toBe(MATCH_SCORES.nameStartsWith)
    expect(scoreTextMatch('Extra Hot Salsa', 'hot')).toBe(MATCH_SCORES.nameContains)
  })

  it('is case-insensitive', () => {
    expect(scoreTextMatch('HOT SALSA', 'hot')).toBe(MATCH_SCORES.nameStartsWith)
  })

  it('scores a miss as zero', () => {
    expect(scoreTextMatch('Mild Salsa', 'hot')).toBe(0)
  })

  it('scores an empty query as zero rather than matching everything', () => {
    expect(scoreTextMatch('Anything', '   ')).toBe(0)
  })
})

describe('rankResults', () => {
  it('puts higher scores first', () => {
    const ranked = rankResults([
      result({ id: 'low', score: 30 }),
      result({ id: 'high', score: 100 }),
    ])
    expect(ranked.map((r) => r.id)).toEqual(['high', 'low'])
  })

  it('breaks a score tie by entity, favouring orders', () => {
    // Staff search for orders far more often than anything else.
    const ranked = rankResults([
      result({ entity: 'product', id: 'p', score: 50 }),
      result({ entity: 'order', id: 'o', score: 50 }),
    ])
    expect(ranked.map((r) => r.id)).toEqual(['o', 'p'])
  })

  it('is stable for identical scores and entities', () => {
    const ranked = rankResults([
      result({ id: 'b', title: 'Beta', score: 10 }),
      result({ id: 'a', title: 'Alpha', score: 10 }),
    ])
    expect(ranked.map((r) => r.title)).toEqual(['Alpha', 'Beta'])
  })

  it('caps the result count', () => {
    const many = Array.from({ length: 50 }, (_, i) => result({ id: String(i), score: i }))
    expect(rankResults(many, 5)).toHaveLength(5)
  })
})

describe('groupResults', () => {
  it('groups by entity in priority order', () => {
    const grouped = groupResults([
      result({ entity: 'product', id: 'p' }),
      result({ entity: 'order', id: 'o' }),
      result({ entity: 'customer', id: 'c' }),
    ])
    expect(grouped.map(([entity]) => entity)).toEqual(['order', 'customer', 'product'])
  })

  it('preserves rank within a group', () => {
    const grouped = groupResults([
      result({ entity: 'order', id: 'first' }),
      result({ entity: 'order', id: 'second' }),
    ])
    expect(grouped[0][1].map((r) => r.id)).toEqual(['first', 'second'])
  })

  it('handles an empty result set', () => {
    expect(groupResults([])).toEqual([])
  })
})

describe('isSearchable', () => {
  it('refuses queries too short to narrow anything', () => {
    expect(isSearchable('a')).toBe(false)
    expect(isSearchable('  ')).toBe(false)
    expect(isSearchable('ab')).toBe(true)
  })
})
