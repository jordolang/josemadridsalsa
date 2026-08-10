import { describe, expect, it } from 'vitest'

import {
  FINAL_STAGE,
  STAGE_DELAY_MS,
  abandonedCartWhere,
  customerName,
  formatCartTotal,
  stageCopy,
} from '@/lib/checkout/abandoned-cart'

const NOW = new Date('2026-08-10T12:00:00Z')
const HOUR = 60 * 60 * 1000

describe('abandonedCartWhere', () => {
  it('never re-emails a recovered cart', () => {
    expect(abandonedCartWhere(NOW).recoveredAt).toBeNull()
  })

  it('stops after the final stage', () => {
    expect(abandonedCartWhere(NOW).emailStage).toEqual({ lt: FINAL_STAGE })
  })

  it('measures the first reminder from when the shopper last touched the cart', () => {
    const [first] = abandonedCartWhere(NOW).OR as Array<Record<string, never>>

    expect(first).toEqual({
      emailStage: 0,
      updatedAt: { lte: new Date(NOW.getTime() - 1 * HOUR) },
    })
  })

  it('measures later reminders from the previous email, not from the cart', () => {
    // Measuring everything from `updatedAt` would fire all three in one sweep once a cart was
    // two days old, which is three emails in a minute rather than over two days.
    const clauses = abandonedCartWhere(NOW).OR as Array<Record<string, never>>

    expect(clauses[1]).toEqual({
      emailStage: 1,
      emailSentAt: { lte: new Date(NOW.getTime() - 24 * HOUR) },
    })
    expect(clauses[2]).toEqual({
      emailStage: 2,
      emailSentAt: { lte: new Date(NOW.getTime() - 48 * HOUR) },
    })
  })

  it('keeps the delays increasing, so the sequence spreads rather than bunches', () => {
    expect(STAGE_DELAY_MS[1]).toBeLessThan(STAGE_DELAY_MS[2])
    expect(STAGE_DELAY_MS[2]).toBeLessThan(STAGE_DELAY_MS[3])
  })
})

describe('formatCartTotal', () => {
  it('uses the recorded total when there is one', () => {
    expect(formatCartTotal({ total: 42.5 })).toBe('$42.50')
  })

  it('falls back to summing the lines', () => {
    expect(
      formatCartTotal({ items: [{ price: 10, quantity: 3 }, { totalPrice: 12.5, quantity: 1 }] })
    ).toBe('$42.50')
  })

  it('prefers a line total over unit price when both are present', () => {
    expect(formatCartTotal({ items: [{ price: 99, totalPrice: 10, quantity: 2 }] })).toBe('$20.00')
  })

  it('assumes one unit when quantity is missing', () => {
    expect(formatCartTotal({ items: [{ price: 10 }] })).toBe('$10.00')
  })

  it.each([null, undefined, {}, { items: [] }, 'nonsense', 42])(
    'says "your items" rather than a wrong price for %p',
    (input) => {
      // Cart JSON is a stored blob whose shape is not guaranteed across storefront versions,
      // and a wrong price in a marketing email is worse than a vague one.
      expect(formatCartTotal(input)).toBe('your items')
    }
  )

  it('does not render $0.00 for a cart that priced out at zero', () => {
    expect(formatCartTotal({ items: [{ price: 0, quantity: 2 }] })).toBe('your items')
  })
})

describe('customerName', () => {
  it('uses the account name when there is one', () => {
    expect(customerName('Ada', 'ada@example.com')).toBe('Ada')
  })

  it('falls back to the local part of the address', () => {
    expect(customerName(null, 'sam.jones@example.com')).toBe('sam.jones')
  })

  it('greets an anonymous shopper rather than rendering nothing', () => {
    expect(customerName(null, null)).toBe('there')
  })
})

describe('stageCopy', () => {
  it('escalates across the three stages', () => {
    expect(stageCopy(1).subject).toContain('left something behind')
    expect(stageCopy(3).subject).toContain('Last chance')
  })

  it('never returns an empty subject line', () => {
    for (const stage of [0, 1, 2, 3, 99]) {
      expect(stageCopy(stage).subject.length).toBeGreaterThan(0)
    }
  })
})
