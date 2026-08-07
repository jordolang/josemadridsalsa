import { describe, expect, it } from 'vitest'

import {
  isAllClear,
  needsShippingWhere,
  OPERATIONAL_QUEUES,
  openReturnsWhere,
  paymentFailedWhere,
  rankQueues,
  stuckPendingWhere,
  totalOutstanding,
} from '@/lib/admin/operational-queues'

describe('queue definitions', () => {
  it('every queue links somewhere, so a count is never a dead end', () => {
    // The whole point of the operational view: "7 need shipping" must be clickable.
    for (const queue of OPERATIONAL_QUEUES) {
      expect(queue.href).toMatch(/^\/admin\//)
      expect(queue.label.length).toBeGreaterThan(0)
      expect(queue.action.length).toBeGreaterThan(0)
    }
  })

  it('has unique keys', () => {
    const keys = OPERATIONAL_QUEUES.map((q) => q.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('needs-shipping tolerates the legacy paid status', () => {
    // Orders paid before the payment-status reconciliation are stored as SUCCEEDED; missing
    // them here means an order silently never gets shipped.
    expect(needsShippingWhere.paymentStatus).toEqual({
      in: expect.arrayContaining(['PAID', 'SUCCEEDED']),
    })
    expect(needsShippingWhere.fulfillmentStatus).toEqual({
      notIn: expect.arrayContaining(['FULFILLED', 'DELIVERED', 'RETURNED']),
    })
  })

  it('excludes cancelled and refunded orders from the shipping queue', () => {
    expect(needsShippingWhere.status).toEqual({ notIn: ['CANCELLED', 'REFUNDED'] })
  })

  it('does not count cancelled orders as payment failures', () => {
    expect(paymentFailedWhere.status).toEqual({ notIn: ['CANCELLED'] })
  })

  it('counts only returns that still need a decision', () => {
    expect(openReturnsWhere.status).toEqual({
      notIn: expect.arrayContaining(['REJECTED', 'COMPLETED', 'CANCELLED']),
    })
  })

  it('bounds stuck-pending by age so fresh checkouts are not flagged', () => {
    const cutoff = new Date('2026-08-07T12:00:00Z')
    const where = stuckPendingWhere(cutoff)

    expect(where.createdAt).toEqual({ lt: cutoff })
    expect(where.status).toBe('PENDING')
    expect(where.paymentStatus).toEqual({ in: expect.arrayContaining(['PAID', 'SUCCEEDED']) })
  })
})

describe('rankQueues', () => {
  it('puts anything needing attention above everything that is clear', () => {
    const ranked = rankQueues({ fundraiserSignups: 1 })

    expect(ranked[0].key).toBe('fundraiserSignups')
    expect(ranked.slice(1).every((q) => q.count === 0)).toBe(true)
  })

  it('orders non-empty queues by severity before size', () => {
    // One failed payment outranks fifty pending signups: money broken beats admin backlog.
    const ranked = rankQueues({ paymentFailed: 1, fundraiserSignups: 50 }).filter(
      (q) => q.count > 0
    )

    expect(ranked.map((q) => q.key)).toEqual(['paymentFailed', 'fundraiserSignups'])
  })

  it('orders equal severity by size', () => {
    const ranked = rankQueues({ needsShipping: 2, openReturns: 9, inventoryAlerts: 5 }).filter(
      (q) => q.count > 0
    )

    expect(ranked.map((q) => q.count)).toEqual([9, 5, 2])
  })

  it('returns every queue even when all counts are missing', () => {
    expect(rankQueues({})).toHaveLength(OPERATIONAL_QUEUES.length)
    expect(rankQueues({}).every((q) => q.count === 0)).toBe(true)
  })

  it('ignores counts for keys that are not queues', () => {
    const ranked = rankQueues({ notAQueue: 99 })
    expect(ranked.every((q) => q.count === 0)).toBe(true)
  })
})

describe('summary helpers', () => {
  it('reports all clear only when nothing is outstanding', () => {
    expect(isAllClear({})).toBe(true)
    expect(isAllClear({ needsShipping: 0 })).toBe(true)
    expect(isAllClear({ needsShipping: 1 })).toBe(false)
  })

  it('totals only real queues', () => {
    expect(totalOutstanding({ needsShipping: 3, openReturns: 2, notAQueue: 100 })).toBe(5)
  })
})
