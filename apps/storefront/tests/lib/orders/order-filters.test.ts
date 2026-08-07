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

  it('treats a picked end date as the whole day, not midnight', () => {
    // Regression: "To: Feb 1" resolved to Feb 1 00:00 UTC and excluded everything ordered
    // that day. Date pickers are inclusive of the day selected.
    const range = buildOrderWhere(
      parseOrderFilters({ startDate: '2026-01-01', endDate: '2026-02-01' })
    ).createdAt as { gte: Date; lte: Date }

    const middayOnEndDate = new Date('2026-02-01T17:00:00Z')
    expect(range.lte.getTime()).toBeGreaterThan(middayOnEndDate.getTime())
    expect(range.gte.getTime()).toBeLessThan(range.lte.getTime())
  })

  it('anchors both bounds to the business day in Eastern time', () => {
    const range = buildOrderWhere(
      parseOrderFilters({ startDate: '2026-01-15', endDate: '2026-01-15' })
    ).createdAt as { gte: Date; lte: Date }

    // Jan 15 is EST (UTC-5): local midnight is 05:00Z, end of day is 04:59:59.999Z next day.
    expect(range.gte.toISOString()).toBe('2026-01-15T05:00:00.000Z')
    expect(range.lte.toISOString()).toBe('2026-01-16T04:59:59.999Z')
  })

  it('handles daylight saving on the summer side of the year', () => {
    const range = buildOrderWhere(parseOrderFilters({ startDate: '2026-07-15' }))
      .createdAt as { gte: Date }

    // July is EDT (UTC-4), so local midnight is 04:00Z rather than 05:00Z.
    expect(range.gte.toISOString()).toBe('2026-07-15T04:00:00.000Z')
  })

  it('builds a one-sided date range', () => {
    const where = buildOrderWhere(parseOrderFilters({ startDate: '2026-01-01' }))
    expect((where.createdAt as { gte: Date }).gte).toBeInstanceOf(Date)
    expect((where.createdAt as { lte?: Date }).lte).toBeUndefined()
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

  it('discards a leftover filter that the view constrains itself', () => {
    // Regression: clicking Payment Failed then Needs Shipping left paymentStatus=FAILED in
    // the URL. ANDed against the view's own paymentStatus IN (PAID, SUCCEEDED) that is
    // unsatisfiable, so Needs Shipping rendered empty — the exact false negative the
    // PAID_PAYMENT_STATUSES handling exists to prevent.
    const where = buildOrderWhere(
      parseOrderFilters({ view: 'needs-shipping', paymentStatus: 'FAILED' })
    )

    expect(where.paymentStatus).toBeUndefined()
    expect((where.AND as Record<string, any>[])[0].paymentStatus.in).toEqual(
      expect.arrayContaining(['PAID', 'SUCCEEDED'])
    )
  })

  it('discards a leftover fulfillment selection that Local Pickup constrains', () => {
    const where = buildOrderWhere(
      parseOrderFilters({ view: 'local-pickup', fulfillmentStatus: 'FULFILLED' })
    )

    expect(where.fulfillmentStatus).toBeUndefined()
    expect((where.AND as Record<string, any>[])[0].fulfillmentStatus.notIn).toContain('FULFILLED')
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
