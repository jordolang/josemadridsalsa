import { describe, expect, it } from 'vitest'

import {
  MAX_DAYS_AFTER_DELIVERY,
  MIN_DAYS_AFTER_DELIVERY,
  reviewRequestRecipient,
  reviewRequestWhere,
  reviewRequestWindow,
} from '@/lib/orders/review-requests'

const NOW = new Date('2026-08-10T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

describe('reviewRequestWindow', () => {
  it('opens at the older bound and closes at the newer one', () => {
    // The inversion is the trap: an order delivered longer ago has the earlier timestamp, so
    // the maximum age produces `gte`. Reversed, the range is empty and the cron sends nothing.
    const window = reviewRequestWindow(NOW)

    expect(window.gte.getTime()).toBe(NOW.getTime() - MAX_DAYS_AFTER_DELIVERY * DAY)
    expect(window.lte.getTime()).toBe(NOW.getTime() - MIN_DAYS_AFTER_DELIVERY * DAY)
    expect(window.gte.getTime()).toBeLessThan(window.lte.getTime())
  })

  it('includes an order delivered squarely inside the window', () => {
    const { gte, lte } = reviewRequestWindow(NOW)
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * DAY)

    expect(fiveDaysAgo >= gte && fiveDaysAgo <= lte).toBe(true)
  })

  it('excludes an order delivered yesterday, which is too soon to ask', () => {
    const { gte, lte } = reviewRequestWindow(NOW)
    const yesterday = new Date(NOW.getTime() - 1 * DAY)

    expect(yesterday >= gte && yesterday <= lte).toBe(false)
  })

  it('excludes an order delivered a month ago, which is too late to ask', () => {
    const { gte, lte } = reviewRequestWindow(NOW)
    const monthAgo = new Date(NOW.getTime() - 30 * DAY)

    expect(monthAgo >= gte && monthAgo <= lte).toBe(false)
  })
})

describe('reviewRequestWhere', () => {
  it('asks only about delivered orders', () => {
    expect(reviewRequestWhere(NOW).status).toBe('DELIVERED')
  })

  it('guards on its own sent-marker, not on the confirmation timestamp', () => {
    // Keying off `confirmationEmailSentAt` is the historical bug: every successful checkout
    // stamps it, so the filter only matched orders that never got a confirmation.
    const where = reviewRequestWhere(NOW)

    expect(where.reviewRequestSentAt).toBeNull()
    expect(where).not.toHaveProperty('confirmationEmailSentAt')
  })

  it('excludes orders with no way to reach anybody', () => {
    expect(reviewRequestWhere(NOW).OR).toEqual([
      { userId: { not: null } },
      { guestEmail: { not: null } },
    ])
  })
})

describe('reviewRequestRecipient', () => {
  const order = {
    orderNumber: 'JMS-1042',
    guestEmail: 'guest@example.com',
    user: null,
    items: [{ productName: 'Black Bean & Corn' }],
  }

  it('builds the email from a guest order', () => {
    expect(reviewRequestRecipient(order)).toEqual({
      email: 'guest@example.com',
      name: 'there',
      orderNumber: 'JMS-1042',
      productName: 'Black Bean & Corn',
    })
  })

  it('prefers the account name and email', () => {
    const recipient = reviewRequestRecipient({
      ...order,
      user: { email: 'ada@example.com', name: 'Ada' },
    })

    expect(recipient).toMatchObject({ email: 'ada@example.com', name: 'Ada' })
  })

  it('describes the order generically rather than rendering "your undefined"', () => {
    expect(reviewRequestRecipient({ ...order, items: [] })?.productName).toBe(
      'your José Madrid Salsa'
    )
  })

  it('returns null when there is no address, so the caller can count it as skipped', () => {
    expect(reviewRequestRecipient({ ...order, guestEmail: null, user: null })).toBeNull()
  })

  it('does not treat a user row without an email as reachable', () => {
    expect(
      reviewRequestRecipient({
        ...order,
        guestEmail: null,
        user: { email: null, name: 'Ada' },
      })
    ).toBeNull()
  })
})
