import { describe, expect, it } from 'vitest'

import {
  HIGH_VALUE_ORDER_THRESHOLD,
  buildOrderWhere,
  getSavedView,
  hasActiveOrderFilters,
  parseOrderFilters,
  SAVED_ORDER_VIEWS,
} from '@/lib/orders/order-filters'

describe('parseOrderFilters', () => {
  it('returns no constraints for an empty query', () => {
    expect(buildOrderWhere(parseOrderFilters({}))).toEqual({})
  })

  it('treats "all" and empty string as no constraint', () => {
    const where = buildOrderWhere(parseOrderFilters({ status: 'all', salesChannel: '' }))
    expect(where.status).toBeUndefined()
    expect(where.salesChannel).toBeUndefined()
  })

  it('ignores a hand-edited invalid enum rather than throwing', () => {
    expect(() => parseOrderFilters({ status: 'NONSENSE' })).not.toThrow()
    expect(buildOrderWhere(parseOrderFilters({ status: 'NONSENSE' })).status).toBeUndefined()
  })

  it('ignores unparseable numbers and dates', () => {
    const where = buildOrderWhere(parseOrderFilters({ minTotal: 'abc', startDate: 'not-a-date' }))
    expect(where.total).toBeUndefined()
    expect(where.createdAt).toBeUndefined()
  })
})

describe('buildOrderWhere', () => {
  it('searches order number, guest email, tracking number and user', () => {
    const where = buildOrderWhere(parseOrderFilters({ search: 'JMS-1' }))
    expect(where.OR).toHaveLength(4)
  })

  it('applies the new Phase 1 dimensions', () => {
    const where = buildOrderWhere(
      parseOrderFilters({ fulfillmentStatus: 'UNFULFILLED', salesChannel: 'FUNDRAISER' })
    )
    expect(where.fulfillmentStatus).toBe('UNFULFILLED')
    expect(where.salesChannel).toBe('FUNDRAISER')
  })

  it('builds a bounded date range', () => {
    const where = buildOrderWhere(
      parseOrderFilters({ startDate: '2026-01-01', endDate: '2026-02-01' })
    )
    expect(where.createdAt).toEqual({
      gte: new Date('2026-01-01'),
      lte: new Date('2026-02-01'),
    })
  })

  it('builds a one-sided date range', () => {
    expect(buildOrderWhere(parseOrderFilters({ startDate: '2026-01-01' })).createdAt).toEqual({
      gte: new Date('2026-01-01'),
    })
  })

  it('builds a value range', () => {
    expect(buildOrderWhere(parseOrderFilters({ minTotal: '50', maxTotal: '500' })).total).toEqual({
      gte: 50,
      lte: 500,
    })
  })

  it('keeps a zero minimum rather than discarding it as falsy', () => {
    expect(buildOrderWhere(parseOrderFilters({ minTotal: '0' })).total).toEqual({ gte: 0 })
  })
})

describe('saved views', () => {
  it('exposes every view by key', () => {
    for (const view of SAVED_ORDER_VIEWS) {
      expect(getSavedView(view.key)).toBe(view)
    }
    expect(getSavedView('nope')).toBeUndefined()
    expect(getSavedView(undefined)).toBeUndefined()
  })

  it('Needs Shipping matches paid orders that are not settled', () => {
    const where = buildOrderWhere(parseOrderFilters({ view: 'needs-shipping' }))
    const clause = (where.AND as Record<string, any>[])[0]

    // Must tolerate the legacy SUCCEEDED value — orders paid before the payment-status
    // reconciliation are still stored that way, and missing one means it never ships.
    expect(clause.paymentStatus.in).toEqual(expect.arrayContaining(['PAID', 'SUCCEEDED']))
    expect(clause.fulfillmentStatus.notIn).toEqual(
      expect.arrayContaining(['FULFILLED', 'DELIVERED', 'RETURNED'])
    )
    expect(clause.status.notIn).toEqual(expect.arrayContaining(['CANCELLED', 'REFUNDED']))
  })

  it('High Value uses the documented threshold', () => {
    expect(buildOrderWhere(parseOrderFilters({ view: 'high-value' })).total).toEqual({
      gte: HIGH_VALUE_ORDER_THRESHOLD,
    })
  })

  it('Payment Failed and Fundraiser map to single dimensions', () => {
    expect(buildOrderWhere(parseOrderFilters({ view: 'payment-failed' })).paymentStatus).toBe(
      'FAILED'
    )
    expect(buildOrderWhere(parseOrderFilters({ view: 'fundraiser' })).salesChannel).toBe(
      'FUNDRAISER'
    )
  })

  it('Local Pickup narrows to unsettled in-store pickups', () => {
    const where = buildOrderWhere(parseOrderFilters({ view: 'local-pickup' }))
    expect(where.shippingMethod).toBe('IN_STORE_PICKUP')
    expect((where.AND as Record<string, any>[])[0].fulfillmentStatus.notIn).toContain('FULFILLED')
  })

  it("a view's own filters win over conflicting user selections", () => {
    // Clicking a named view should always show what it says on the tin.
    const where = buildOrderWhere(
      parseOrderFilters({ view: 'payment-failed', paymentStatus: 'PAID' })
    )
    expect(where.paymentStatus).toBe('FAILED')
  })

  it('a view still respects orthogonal filters like search', () => {
    const where = buildOrderWhere(parseOrderFilters({ view: 'high-value', search: 'JMS-1' }))
    expect(where.OR).toBeDefined()
    expect(where.total).toEqual({ gte: HIGH_VALUE_ORDER_THRESHOLD })
  })
})

describe('hasActiveOrderFilters', () => {
  it('is false for an empty query and true once anything is set', () => {
    expect(hasActiveOrderFilters(parseOrderFilters({}))).toBe(false)
    expect(hasActiveOrderFilters(parseOrderFilters({ status: 'all' }))).toBe(false)
    expect(hasActiveOrderFilters(parseOrderFilters({ status: 'SHIPPED' }))).toBe(true)
  })
})
