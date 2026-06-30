import { describe, it, expect } from 'vitest'
import { parseMetaCheckoutParams } from '@/lib/social/meta-checkout'

describe('parseMetaCheckoutParams', () => {
  it('parses a single product entry', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003:2')
    expect(result.items).toEqual([{ ref: 'JMS-MILD-003', quantity: 2 }])
    expect(result.coupon).toBeNull()
    expect(result.errors).toEqual([])
  })

  it('parses multiple product entries (matching the Meta sample format)', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003:2,JMS-FRUIT-001:1')
    expect(result.items).toEqual([
      { ref: 'JMS-MILD-003', quantity: 2 },
      { ref: 'JMS-FRUIT-001', quantity: 1 },
    ])
  })

  it('returns a normalized coupon when provided', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003:1', '  SALSA10  ')
    expect(result.coupon).toBe('SALSA10')
  })

  it('treats a blank coupon as none', () => {
    expect(parseMetaCheckoutParams('JMS-MILD-003:1', '   ').coupon).toBeNull()
    expect(parseMetaCheckoutParams('JMS-MILD-003:1', '').coupon).toBeNull()
    expect(parseMetaCheckoutParams('JMS-MILD-003:1', null).coupon).toBeNull()
  })

  it('sums quantities for duplicate refs', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003:2,JMS-MILD-003:3')
    expect(result.items).toEqual([{ ref: 'JMS-MILD-003', quantity: 5 }])
  })

  it('caps a line quantity at 99', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003:500')
    expect(result.items).toEqual([{ ref: 'JMS-MILD-003', quantity: 99 }])
  })

  it('records an error and skips an entry with no quantity', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003')
    expect(result.items).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it('records an error and skips a non-numeric quantity', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003:abc')
    expect(result.items).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it('rejects zero and negative quantities', () => {
    expect(parseMetaCheckoutParams('A:0').items).toEqual([])
    expect(parseMetaCheckoutParams('A:-1').items).toEqual([])
  })

  it('rejects fractional quantities', () => {
    const result = parseMetaCheckoutParams('A:2.5')
    expect(result.items).toEqual([])
    expect(result.errors).toHaveLength(1)
  })

  it('keeps valid entries while reporting malformed ones', () => {
    const result = parseMetaCheckoutParams('JMS-MILD-003:2,broken,JMS-FRUIT-001:1')
    expect(result.items).toEqual([
      { ref: 'JMS-MILD-003', quantity: 2 },
      { ref: 'JMS-FRUIT-001', quantity: 1 },
    ])
    expect(result.errors).toHaveLength(1)
  })

  it('tolerates surrounding whitespace and trailing commas', () => {
    const result = parseMetaCheckoutParams(' JMS-MILD-003 : 2 , ')
    expect(result.items).toEqual([{ ref: 'JMS-MILD-003', quantity: 2 }])
    expect(result.errors).toEqual([])
  })

  it('returns empty results for empty/null products', () => {
    expect(parseMetaCheckoutParams('').items).toEqual([])
    expect(parseMetaCheckoutParams(null).items).toEqual([])
    expect(parseMetaCheckoutParams(undefined).items).toEqual([])
  })
})
