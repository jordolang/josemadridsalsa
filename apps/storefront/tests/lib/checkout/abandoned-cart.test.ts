import { describe, expect, it } from 'vitest'

import {
  FINAL_STAGE,
  RECOVERY_LINK_TTL_MS,
  STAGE_DELAY_MS,
  abandonedCartWhere,
  customerName,
  formatCartTotal,
  hoursWaiting,
  recoveryLinkExpiresIn,
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

describe('hoursWaiting', () => {
  it('counts from when the shopper last touched the cart', () => {
    expect(hoursWaiting(new Date(NOW.getTime() - 25 * HOUR), NOW)).toBe(25)
  })

  it('rounds to the nearest whole hour', () => {
    expect(hoursWaiting(new Date(NOW.getTime() - 3.4 * HOUR), NOW)).toBe(3)
    expect(hoursWaiting(new Date(NOW.getTime() - 3.6 * HOUR), NOW)).toBe(4)
  })

  it('never says a cart has been waiting for zero hours', () => {
    expect(hoursWaiting(NOW, NOW)).toBe(1)
  })
})

describe('recoveryLinkExpiresIn', () => {
  it('counts down to the moment the recovery route starts refusing the link', () => {
    const createdAt = new Date(NOW.getTime() - RECOVERY_LINK_TTL_MS + 2 * HOUR)

    expect(recoveryLinkExpiresIn(createdAt, NOW)).toBe('2 hours')
  })

  it('speaks in days once there is more than a couple left', () => {
    // A cart mailed at stage 3 is barely two days old, so this is the case that ships.
    const createdAt = new Date(NOW.getTime() - 49 * HOUR)

    expect(recoveryLinkExpiresIn(createdAt, NOW)).toBe('28 days')
  })

  it('has nothing to promise once the link has expired', () => {
    const createdAt = new Date(NOW.getTime() - RECOVERY_LINK_TTL_MS)

    expect(recoveryLinkExpiresIn(createdAt, NOW)).toBeNull()
  })

  it('never says "1 hours"', () => {
    const createdAt = new Date(NOW.getTime() - RECOVERY_LINK_TTL_MS + 30 * 60 * 1000)

    expect(recoveryLinkExpiresIn(createdAt, NOW)).toBe('1 hour')
  })
})
