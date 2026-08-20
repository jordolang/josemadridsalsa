import { describe, expect, it } from 'vitest'

import { formatMinimumOrder, isBelowMinimumOrder } from '@/lib/store-settings'

describe('isBelowMinimumOrder', () => {
  it('is false when there is no minimum (0)', () => {
    expect(isBelowMinimumOrder(0, 0)).toBe(false)
    expect(isBelowMinimumOrder(500, 0)).toBe(false)
  })

  it('flags subtotals strictly under the minimum', () => {
    expect(isBelowMinimumOrder(2499, 2500)).toBe(true)
    expect(isBelowMinimumOrder(2500, 2500)).toBe(false) // exactly the minimum passes
    expect(isBelowMinimumOrder(2501, 2500)).toBe(false)
  })
})

describe('formatMinimumOrder', () => {
  it('formats cents as dollars', () => {
    expect(formatMinimumOrder(2500)).toBe('$25.00')
    expect(formatMinimumOrder(999)).toBe('$9.99')
    expect(formatMinimumOrder(100000)).toBe('$1,000.00')
  })
})
