import { describe, expect, it } from 'vitest'

import {
  buildFulfillmentUpdate,
  deriveFulfillmentStatus,
  fulfillmentStatusFor,
  isAwaitingFulfillment,
  isTerminalOrderStatus,
  transitionForOrderStatus,
} from '@/lib/orders/fulfillment'

describe('deriveFulfillmentStatus', () => {
  it('treats an order with no items as unfulfilled', () => {
    expect(deriveFulfillmentStatus([])).toBe('UNFULFILLED')
  })

  it('is unfulfilled when nothing has shipped', () => {
    expect(
      deriveFulfillmentStatus([
        { quantity: 3, quantityFulfilled: 0 },
        { quantity: 1, quantityFulfilled: 0 },
      ])
    ).toBe('UNFULFILLED')
  })

  it('is fulfilled when every item has shipped', () => {
    expect(
      deriveFulfillmentStatus([
        { quantity: 3, quantityFulfilled: 3 },
        { quantity: 1, quantityFulfilled: 1 },
      ])
    ).toBe('FULFILLED')
  })

  it('is partially fulfilled when only some units have shipped', () => {
    expect(
      deriveFulfillmentStatus([
        { quantity: 3, quantityFulfilled: 1 },
        { quantity: 1, quantityFulfilled: 0 },
      ])
    ).toBe('PARTIALLY_FULFILLED')
  })

  it('is partially fulfilled when one whole line shipped but another has not', () => {
    expect(
      deriveFulfillmentStatus([
        { quantity: 2, quantityFulfilled: 2 },
        { quantity: 5, quantityFulfilled: 0 },
      ])
    ).toBe('PARTIALLY_FULFILLED')
  })

  it('does not let an over-count make a partial order look complete', () => {
    // A bad write leaving quantityFulfilled above quantity must not mask the line that
    // genuinely has not shipped.
    expect(
      deriveFulfillmentStatus([
        { quantity: 1, quantityFulfilled: 9 },
        { quantity: 4, quantityFulfilled: 0 },
      ])
    ).toBe('PARTIALLY_FULFILLED')
  })
})

describe('isAwaitingFulfillment', () => {
  it('flags orders that still need shipping', () => {
    expect(isAwaitingFulfillment('UNFULFILLED')).toBe(true)
    expect(isAwaitingFulfillment('PARTIALLY_FULFILLED')).toBe(true)
  })

  it('excludes orders that are settled', () => {
    expect(isAwaitingFulfillment('FULFILLED')).toBe(false)
    expect(isAwaitingFulfillment('DELIVERED')).toBe(false)
    expect(isAwaitingFulfillment('RETURNED')).toBe(false)
  })
})

describe('buildFulfillmentUpdate', () => {
  const now = new Date('2026-08-07T12:00:00.000Z')

  it('sets fulfillment status, order status and shippedAt together on ship', () => {
    const update = buildFulfillmentUpdate({
      transition: 'shipped',
      current: { status: 'PROCESSING', shippedAt: null, deliveredAt: null },
      now,
    })

    expect(update).toEqual({
      fulfillmentStatus: 'FULFILLED',
      shippedAt: now,
      status: 'SHIPPED',
    })
  })

  it('does not restamp shippedAt on an order that already shipped', () => {
    const alreadyShipped = new Date('2026-08-01T00:00:00.000Z')
    const update = buildFulfillmentUpdate({
      transition: 'shipped',
      current: { status: 'SHIPPED', shippedAt: alreadyShipped, deliveredAt: null },
      now,
    })

    expect(update.shippedAt).toBeUndefined()
    expect(update.fulfillmentStatus).toBe('FULFILLED')
  })

  it('stamps shippedAt as well as deliveredAt when delivery is the first signal seen', () => {
    // Carriers can report delivery without an in-transit event ever arriving.
    const update = buildFulfillmentUpdate({
      transition: 'delivered',
      current: { status: 'PROCESSING', shippedAt: null, deliveredAt: null },
      now,
    })

    expect(update).toEqual({
      fulfillmentStatus: 'DELIVERED',
      shippedAt: now,
      deliveredAt: now,
      status: 'DELIVERED',
    })
  })

  it('does not resurrect a cancelled order when a late tracking event arrives', () => {
    const update = buildFulfillmentUpdate({
      transition: 'delivered',
      current: { status: 'CANCELLED', shippedAt: null, deliveredAt: null },
      now,
    })

    expect(update.status).toBeUndefined()
    expect(update.fulfillmentStatus).toBe('DELIVERED')
  })

  it('does not resurrect a refunded order either', () => {
    const update = buildFulfillmentUpdate({
      transition: 'shipped',
      current: { status: 'REFUNDED', shippedAt: null, deliveredAt: null },
      now,
    })

    expect(update.status).toBeUndefined()
  })

  it('leaves the commercial status alone when the caller owns it', () => {
    const update = buildFulfillmentUpdate({
      transition: 'shipped',
      current: { status: 'PROCESSING', shippedAt: null, deliveredAt: null },
      syncOrderStatus: false,
      now,
    })

    expect(update.status).toBeUndefined()
    expect(update.fulfillmentStatus).toBe('FULFILLED')
  })

  it('does not mark a partially shipped order as SHIPPED', () => {
    const update = buildFulfillmentUpdate({
      transition: 'partially_shipped',
      current: { status: 'CONFIRMED', shippedAt: null, deliveredAt: null },
      now,
    })

    expect(update.fulfillmentStatus).toBe('PARTIALLY_FULFILLED')
    expect(update.status).toBe('PROCESSING')
  })
})

describe('fulfillmentStatusFor', () => {
  // The bulk-status route cannot use buildFulfillmentUpdate (updateMany takes no per-row
  // values), so it reads the mapping from here rather than keeping a second copy.
  it('agrees with what buildFulfillmentUpdate would set', () => {
    const cases = ['shipped', 'partially_shipped', 'delivered', 'returned', 'unfulfilled'] as const

    for (const transition of cases) {
      const viaBuilder = buildFulfillmentUpdate({
        transition,
        current: { status: 'PROCESSING' },
      }).fulfillmentStatus

      expect(fulfillmentStatusFor(transition)).toBe(viaBuilder)
    }
  })
})

describe('isTerminalOrderStatus', () => {
  // Guards the bulk path: an order cancelled or refunded before a batch "mark shipped"
  // must not come out of it marked FULFILLED.
  it('protects cancelled and refunded orders', () => {
    expect(isTerminalOrderStatus('CANCELLED')).toBe(true)
    expect(isTerminalOrderStatus('REFUNDED')).toBe(true)
  })

  it('leaves in-flight orders alone', () => {
    for (const status of ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const) {
      expect(isTerminalOrderStatus(status)).toBe(false)
    }
  })
})

describe('transitionForOrderStatus', () => {
  it('maps shipping and delivery statuses', () => {
    expect(transitionForOrderStatus('SHIPPED', {})).toBe('shipped')
    expect(transitionForOrderStatus('DELIVERED', {})).toBe('delivered')
  })

  it('says nothing about fulfillment for statuses that do not imply it', () => {
    expect(transitionForOrderStatus('PENDING', {})).toBeNull()
    expect(transitionForOrderStatus('CONFIRMED', {})).toBeNull()
    expect(transitionForOrderStatus('PROCESSING', {})).toBeNull()
    expect(transitionForOrderStatus('CANCELLED', {})).toBeNull()
  })

  it('returns goods only when they actually shipped', () => {
    expect(transitionForOrderStatus('REFUNDED', { shippedAt: new Date() })).toBe('returned')
    expect(transitionForOrderStatus('REFUNDED', { deliveredAt: new Date() })).toBe('returned')
  })

  it('does not mark a refunded but never-shipped order as returned', () => {
    expect(transitionForOrderStatus('REFUNDED', { shippedAt: null, deliveredAt: null })).toBeNull()
  })
})
