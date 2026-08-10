import { describe, expect, it } from 'vitest'

import {
  buildFulfillmentUpdate,
  deriveFulfillmentStatus,
  fulfillmentStatusFor,
  isAwaitingFulfillment,
  isDerivedTransition,
  isTerminalOrderStatus,
  remainingToFulfill,
  transitionForOrderStatus,
  validateFulfillmentRequest,
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

  it('sets the order status and shippedAt together on ship', () => {
    const update = buildFulfillmentUpdate({
      transition: 'shipped',
      current: { status: 'PROCESSING', shippedAt: null, deliveredAt: null },
      now,
    })

    // fulfillmentStatus is deliberately absent: it is derived from the item quantities the
    // caller writes, so that the order enum and its items cannot disagree.
    expect(update).toEqual({ shippedAt: now, status: 'SHIPPED' })
  })

  it('does not restamp shippedAt on an order that already shipped', () => {
    const alreadyShipped = new Date('2026-08-01T00:00:00.000Z')
    const update = buildFulfillmentUpdate({
      transition: 'shipped',
      current: { status: 'SHIPPED', shippedAt: alreadyShipped, deliveredAt: null },
      now,
    })

    expect(update.shippedAt).toBeUndefined()
    expect(update.status).toBe('SHIPPED')
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
    expect(update.fulfillmentStatus).toBeUndefined()
  })

  it('does not mark a partially shipped order as SHIPPED', () => {
    const update = buildFulfillmentUpdate({
      transition: 'partially_shipped',
      current: { status: 'CONFIRMED', shippedAt: null, deliveredAt: null },
      now,
    })

    expect(update.fulfillmentStatus).toBeUndefined()
    expect(update.status).toBe('PROCESSING')
  })
})

describe('fulfillmentStatusFor', () => {
  // The bulk-status route cannot use buildFulfillmentUpdate (updateMany takes no per-row
  // values), so it reads the mapping from here rather than keeping a second copy.
  it('agrees with what buildFulfillmentUpdate would set, for every transition', () => {
    const cases = ['shipped', 'partially_shipped', 'delivered', 'returned', 'unfulfilled'] as const

    for (const transition of cases) {
      const viaBuilder = buildFulfillmentUpdate({
        transition,
        current: { status: 'PROCESSING' },
      }).fulfillmentStatus

      // Derived transitions report null here and omit the field there; both mean
      // "the item quantities decide".
      expect(fulfillmentStatusFor(transition) ?? undefined).toBe(viaBuilder)
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

describe('remainingToFulfill', () => {
  it('reports what is left to ship', () => {
    expect(remainingToFulfill({ quantity: 5, quantityFulfilled: 2 })).toBe(3)
    expect(remainingToFulfill({ quantity: 5, quantityFulfilled: 5 })).toBe(0)
  })

  it('never goes negative when a bad write over-counted', () => {
    expect(remainingToFulfill({ quantity: 5, quantityFulfilled: 9 })).toBe(0)
  })
})

describe('validateFulfillmentRequest', () => {
  const items = [
    { id: 'item_a', quantity: 5, quantityFulfilled: 0 },
    { id: 'item_b', quantity: 2, quantityFulfilled: 2 },
  ]

  it('accepts a partial shipment within the remaining balance', () => {
    const result = validateFulfillmentRequest([{ orderItemId: 'item_a', quantity: 3 }], items)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.quantities.get('item_a')).toBe(3)
  })

  it('rejects shipping more than remains', () => {
    // Over-shipping would push quantityFulfilled past quantity and corrupt every
    // downstream count, so it is refused rather than clamped.
    const result = validateFulfillmentRequest([{ orderItemId: 'item_a', quantity: 6 }], items)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EXCEEDS_REMAINING')
      expect(result.error).toMatchObject({ remaining: 5 })
    }
  })

  it('rejects an item that is already fully fulfilled', () => {
    const result = validateFulfillmentRequest([{ orderItemId: 'item_b', quantity: 1 }], items)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.message).toMatch(/already been fully fulfilled/)
  })

  it('accounts for what previous shipments already covered', () => {
    const partly = [{ id: 'item_a', quantity: 5, quantityFulfilled: 4 }]

    expect(validateFulfillmentRequest([{ orderItemId: 'item_a', quantity: 1 }], partly).ok).toBe(
      true
    )
    expect(validateFulfillmentRequest([{ orderItemId: 'item_a', quantity: 2 }], partly).ok).toBe(
      false
    )
  })

  it('sums duplicate lines for the same item before checking the balance', () => {
    // Two lines of 3 against a balance of 5 must fail, even though neither exceeds it alone.
    const result = validateFulfillmentRequest(
      [
        { orderItemId: 'item_a', quantity: 3 },
        { orderItemId: 'item_a', quantity: 3 },
      ],
      items
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EXCEEDS_REMAINING')
  })

  it('rejects an item that belongs to a different order', () => {
    const result = validateFulfillmentRequest([{ orderItemId: 'item_zz', quantity: 1 }], items)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_ITEM')
  })

  it('rejects an empty or all-zero request', () => {
    expect(validateFulfillmentRequest([], items).ok).toBe(false)
    const zeros = validateFulfillmentRequest([{ orderItemId: 'item_a', quantity: 0 }], items)
    expect(zeros.ok).toBe(false)
    if (!zeros.ok) expect(zeros.error.code).toBe('EMPTY')
  })
})

describe('transition status derivation', () => {
  it('derives shipped and partially shipped from items rather than asserting them', () => {
    // Regression guard for the drift Phase 1 exists to prevent: if these ever return a
    // hardcoded status again, the order enum and the item quantities can disagree.
    expect(isDerivedTransition('shipped')).toBe(true)
    expect(isDerivedTransition('partially_shipped')).toBe(true)
    expect(fulfillmentStatusFor('shipped')).toBeNull()
    expect(fulfillmentStatusFor('partially_shipped')).toBeNull()
  })

  it('keeps delivered and returned as order-level overlays', () => {
    // Neither can be inferred from quantities — they describe what happened after shipping.
    expect(isDerivedTransition('delivered')).toBe(false)
    expect(fulfillmentStatusFor('delivered')).toBe('DELIVERED')
    expect(fulfillmentStatusFor('returned')).toBe('RETURNED')
    expect(fulfillmentStatusFor('unfulfilled')).toBe('UNFULFILLED')
  })

  it('does not assert a fulfillment status for a derived transition', () => {
    const update = buildFulfillmentUpdate({
      transition: 'shipped',
      current: { status: 'PROCESSING' },
    })

    expect(update.fulfillmentStatus).toBeUndefined()
    expect(update.status).toBe('SHIPPED')
  })
})

describe('fulfillment quantity accounting', () => {
  /**
   * The invariant returns will depend on: an item's quantityFulfilled must always equal the
   * sum of the FulfillmentItem rows covering it. Modelled here over the pure derivation so
   * it is checked without a database.
   */
  const applyShipments = (
    items: { id: string; quantity: number }[],
    shipments: Record<string, number>[]
  ) => {
    const fulfilled = new Map(items.map((i) => [i.id, 0]))
    for (const shipment of shipments) {
      for (const [id, qty] of Object.entries(shipment)) {
        fulfilled.set(id, (fulfilled.get(id) ?? 0) + qty)
      }
    }
    return items.map((i) => ({ quantity: i.quantity, quantityFulfilled: fulfilled.get(i.id) ?? 0 }))
  }

  const items = [
    { id: 'a', quantity: 3 },
    { id: 'b', quantity: 2 },
  ]

  it('is unfulfilled before anything ships', () => {
    expect(deriveFulfillmentStatus(applyShipments(items, []))).toBe('UNFULFILLED')
  })

  it('accumulates across split shipments rather than overwriting', () => {
    const afterFirst = applyShipments(items, [{ a: 1 }])
    expect(deriveFulfillmentStatus(afterFirst)).toBe('PARTIALLY_FULFILLED')

    const afterSecond = applyShipments(items, [{ a: 1 }, { a: 2, b: 2 }])
    expect(afterSecond).toEqual([
      { quantity: 3, quantityFulfilled: 3 },
      { quantity: 2, quantityFulfilled: 2 },
    ])
    expect(deriveFulfillmentStatus(afterSecond)).toBe('FULFILLED')
  })

  it('stays partial while any line is outstanding', () => {
    expect(deriveFulfillmentStatus(applyShipments(items, [{ a: 3 }]))).toBe('PARTIALLY_FULFILLED')
  })
})
