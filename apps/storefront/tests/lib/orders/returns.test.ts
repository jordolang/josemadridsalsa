import { describe, expect, it } from 'vitest'

import {
  canTransitionReturn,
  computeReturnRefundCents,
  generateRmaNumber,
  isTerminalReturnStatus,
  isWithinReturnWindow,
  nextReturnStatuses,
  planRestock,
  returnableQuantity,
  RETURN_WINDOW_DAYS,
  validateReturnRequest,
} from '@/lib/orders/returns'

const shippedAt = new Date('2026-08-01T10:00:00Z')
const now = new Date('2026-08-07T10:00:00Z')

const items = [
  { id: 'a', quantity: 3, quantityFulfilled: 3, unitPrice: 10 },
  { id: 'b', quantity: 2, quantityFulfilled: 0, unitPrice: 5 },
]

describe('return state machine', () => {
  it('walks the happy path one step at a time', () => {
    expect(canTransitionReturn('REQUESTED', 'APPROVED')).toBe(true)
    expect(canTransitionReturn('APPROVED', 'RECEIVED')).toBe(true)
    expect(canTransitionReturn('RECEIVED', 'COMPLETED')).toBe(true)
  })

  it('will not let a refund be issued before the goods arrive', () => {
    // Approval is agreeing to take it back; receipt is the goods actually turning up.
    expect(canTransitionReturn('REQUESTED', 'COMPLETED')).toBe(false)
    expect(canTransitionReturn('APPROVED', 'COMPLETED')).toBe(false)
  })

  it('does not allow moves out of a terminal state', () => {
    for (const status of ['REJECTED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(nextReturnStatuses(status)).toEqual([])
      expect(isTerminalReturnStatus(status)).toBe(true)
      expect(canTransitionReturn(status, 'APPROVED')).toBe(false)
    }
  })

  it('cannot cancel a return once the goods have been received', () => {
    expect(canTransitionReturn('RECEIVED', 'CANCELLED')).toBe(false)
  })

  it('can reject only before approval', () => {
    expect(canTransitionReturn('REQUESTED', 'REJECTED')).toBe(true)
    expect(canTransitionReturn('APPROVED', 'REJECTED')).toBe(false)
  })
})

describe('returnableQuantity', () => {
  it('is bounded by what shipped, not what was ordered', () => {
    expect(returnableQuantity({ id: 'a', quantity: 5, quantityFulfilled: 2, unitPrice: 1 })).toBe(2)
  })

  it('subtracts what earlier returns already claimed', () => {
    expect(
      returnableQuantity({
        id: 'a',
        quantity: 5,
        quantityFulfilled: 5,
        unitPrice: 1,
        quantityReturned: 2,
      })
    ).toBe(3)
  })

  it('never goes negative', () => {
    expect(
      returnableQuantity({
        id: 'a',
        quantity: 5,
        quantityFulfilled: 1,
        unitPrice: 1,
        quantityReturned: 4,
      })
    ).toBe(0)
  })
})

describe('validateReturnRequest', () => {
  it('accepts a return of shipped units', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'a', quantity: 2 }],
      orderItems: items,
      fulfilledAt: shippedAt,
      now,
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.quantities.get('a')).toBe(2)
  })

  it('refuses to return a line that never shipped', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'b', quantity: 1 }],
      orderItems: items,
      fulfilledAt: shippedAt,
      now,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EXCEEDS_RETURNABLE')
  })

  it('refuses more units than shipped', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'a', quantity: 4 }],
      orderItems: items,
      fulfilledAt: shippedAt,
      now,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatchObject({ returnable: 3 })
  })

  it('sums duplicate lines before checking the balance', () => {
    const result = validateReturnRequest({
      lines: [
        { orderItemId: 'a', quantity: 2 },
        { orderItemId: 'a', quantity: 2 },
      ],
      orderItems: items,
      fulfilledAt: shippedAt,
      now,
    })

    expect(result.ok).toBe(false)
  })

  it('rejects an order where nothing has shipped at all', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'a', quantity: 1 }],
      orderItems: items,
      fulfilledAt: null,
      now,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_FULFILLED')
  })

  it('rejects a request outside the return window', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'a', quantity: 1 }],
      orderItems: items,
      fulfilledAt: shippedAt,
      now: new Date('2026-10-01T10:00:00Z'),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('WINDOW_EXPIRED')
  })

  it('lets staff accept a late return deliberately', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'a', quantity: 1 }],
      orderItems: items,
      fulfilledAt: shippedAt,
      now: new Date('2026-10-01T10:00:00Z'),
      ignoreWindow: true,
    })

    expect(result.ok).toBe(true)
  })

  it('rejects an empty request', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'a', quantity: 0 }],
      orderItems: items,
      fulfilledAt: shippedAt,
      now,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('EMPTY')
  })

  it('rejects an item from a different order', () => {
    const result = validateReturnRequest({
      lines: [{ orderItemId: 'zz', quantity: 1 }],
      orderItems: items,
      fulfilledAt: shippedAt,
      now,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_ITEM')
  })
})

describe('isWithinReturnWindow', () => {
  it('accepts the last day of the window and rejects the day after', () => {
    const day = 24 * 60 * 60 * 1000
    expect(isWithinReturnWindow(shippedAt, new Date(shippedAt.getTime() + RETURN_WINDOW_DAYS * day))).toBe(true)
    expect(
      isWithinReturnWindow(shippedAt, new Date(shippedAt.getTime() + (RETURN_WINDOW_DAYS + 1) * day))
    ).toBe(false)
  })
})

describe('computeReturnRefundCents', () => {
  it('refunds the value of the returned units', () => {
    expect(computeReturnRefundCents(new Map([['a', 2]]), items)).toBe(2000)
  })

  it('withholds a restocking fee', () => {
    expect(computeReturnRefundCents(new Map([['a', 2]]), items, 5)).toBe(1500)
  })

  it('never refunds a negative amount when the fee exceeds the goods', () => {
    // A fee larger than the returned value refunds nothing rather than charging the customer.
    expect(computeReturnRefundCents(new Map([['a', 1]]), items, 50)).toBe(0)
  })

  it('avoids float drift on awkward prices', () => {
    const penny = [{ id: 'a', quantity: 3, quantityFulfilled: 3, unitPrice: 10.1 }]
    expect(computeReturnRefundCents(new Map([['a', 3]]), penny)).toBe(3030)
  })

  it('ignores quantities for items not on the order', () => {
    expect(computeReturnRefundCents(new Map([['zz', 5]]), items)).toBe(0)
  })
})

describe('planRestock', () => {
  const line = (over: Partial<Parameters<typeof planRestock>[0][number]>) => ({
    orderItemId: 'a',
    quantity: 2,
    condition: 'RESELLABLE' as const,
    restocked: false,
    ...over,
  })

  it('returns resellable units to sellable stock', () => {
    expect(planRestock([line({})])).toEqual([
      { orderItemId: 'a', quantity: 2, transactionType: 'RETURN', addsToSellableStock: true },
    ])
  })

  it('records damaged units as a loss instead of restocking them', () => {
    expect(planRestock([line({ condition: 'DAMAGED' })])).toEqual([
      { orderItemId: 'a', quantity: 2, transactionType: 'DAMAGED', addsToSellableStock: false },
    ])
  })

  it('records nothing for discarded units', () => {
    expect(planRestock([line({ condition: 'DISCARDED' })])).toEqual([])
  })

  it('skips lines that have not been inspected yet', () => {
    expect(planRestock([line({ condition: null })])).toEqual([])
  })

  it('skips lines already restocked, so completion is safe to re-run', () => {
    expect(planRestock([line({ restocked: true })])).toEqual([])
  })
})

describe('generateRmaNumber', () => {
  it('is dated and quotable', () => {
    expect(generateRmaNumber(new Date('2026-08-07T12:00:00Z'), () => 0.5)).toBe('RMA-20260807-5500')
  })
})
