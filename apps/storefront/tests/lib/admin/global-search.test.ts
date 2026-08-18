import { describe, expect, it } from 'vitest'

import {
  classifyQuery,
  digitsOnly,
  ENTITY_LABELS,
  extractExcerpt,
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

  it('reads a bare 10-digit number as a phone number, not a tracking number', () => {
    // It satisfies the tracking shape too. Classifying it as tracking sends the search to
    // orders alone and returns nothing for what is plainly a customer's phone number.
    expect(classifyQuery('7405550132')).toBe('phone')
    expect(classifyQuery('17405550132')).toBe('phone')
  })

  it('still reads a longer or lettered code as tracking', () => {
    expect(classifyQuery('1Z999AA10123456784')).toBe('tracking')
    expect(classifyQuery('940010123456784')).toBe('tracking')
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

  it('reaches documents and archive data for free text', () => {
    // The whole point of the box: a fundraiser name should turn up the scanned order form
    // as well as the live campaign.
    expect(searchTargets('text')).toEqual(
      expect.arrayContaining([
        'document',
        'training',
        'media',
        'contact',
        'archived-fundraiser',
        'show-sale',
        'ledger',
        'blog',
        'page',
        'recipe',
      ])
    )
  })

  it('sends a gift-certificate or purchase-order code to its own record', () => {
    // Both satisfy the SKU shape, so without this they scan products and find nothing.
    expect(classifyQuery('JMS-GC-4821-9930')).toBe('sku')
    expect(classifyQuery('PO-20260808-1234')).toBe('sku')
    expect(searchTargets('sku')).toEqual(
      expect.arrayContaining(['gift-certificate', 'purchase-order'])
    )
  })

  it('does not scan products for an email', () => {
    expect(searchTargets('email')).not.toContain('product')
  })

  it('does not scan document text for an email or phone number', () => {
    // Scanning every extracted document body for a pasted phone number would be the most
    // expensive query in the app and would never match anything useful.
    expect(searchTargets('email')).not.toContain('document')
    expect(searchTargets('phone')).not.toContain('document')
  })

  it('reaches the fundraiser contact database for an email and a phone number', () => {
    expect(searchTargets('email')).toContain('contact')
    expect(searchTargets('phone')).toContain('contact')
  })

  it('labels every entity it can return', () => {
    for (const entity of searchTargets('text')) {
      expect(ENTITY_LABELS[entity]).toBeTruthy()
    }
  })
})

describe('extractExcerpt', () => {
  const text = 'The Zanesville High School band sold 240 jars of salsa in the autumn campaign.'

  it('returns the text around the match', () => {
    const excerpt = extractExcerpt(text, 'band')
    expect(excerpt).toContain('band')
  })

  it('is case-insensitive', () => {
    expect(extractExcerpt(text, 'ZANESVILLE')).toContain('Zanesville')
  })

  it('returns null when the query is not in the text', () => {
    // Callers use null to tell a title match from a body match, so a miss must not
    // return a snippet of unrelated text.
    expect(extractExcerpt(text, 'Lancaster')).toBeNull()
  })

  it('returns null for missing text rather than throwing', () => {
    expect(extractExcerpt(null, 'anything')).toBeNull()
    expect(extractExcerpt(undefined, 'anything')).toBeNull()
  })

  it('refuses a blank query instead of excerpting the opening line', () => {
    // An empty string is found at index 0 of everything, which would attach a meaningless
    // excerpt — and a body-match score — to every document.
    expect(extractExcerpt(text, '')).toBeNull()
    expect(extractExcerpt(text, '   ')).toBeNull()
  })

  it('marks a trimmed excerpt with ellipses', () => {
    const long = `${'x'.repeat(500)} needle ${'y'.repeat(500)}`
    const excerpt = extractExcerpt(long, 'needle')
    expect(excerpt?.startsWith('…')).toBe(true)
    expect(excerpt?.endsWith('…')).toBe(true)
    expect(excerpt!.length).toBeLessThan(200)
  })

  it('collapses whitespace so a snippet stays on one line', () => {
    expect(extractExcerpt('order   form\n\n  for Maysville', 'Maysville')).toBe(
      'order form for Maysville'
    )
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

  it('ranks a title match above a match found in document text', () => {
    // Otherwise a document that merely mentions a group buries the one named after it.
    const ranked = rankResults([
      result({ entity: 'document', id: 'mention', score: MATCH_SCORES.bodyContains }),
      result({ entity: 'document', id: 'named', score: MATCH_SCORES.nameContains }),
    ])
    expect(ranked.map((r) => r.id)).toEqual(['named', 'mention'])
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

  it('puts live records above archive and content sections', () => {
    // An operator searching a group name wants the open campaign before the scanned form.
    const grouped = groupResults([
      result({ entity: 'document', id: 'd' }),
      result({ entity: 'blog', id: 'b' }),
      result({ entity: 'fundraiser', id: 'f' }),
    ])
    expect(grouped.map(([entity]) => entity)).toEqual(['fundraiser', 'document', 'blog'])
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
