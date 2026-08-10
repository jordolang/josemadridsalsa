import { describe, expect, it } from 'vitest'

import {
  RULE_EVENT_BY_DOMAIN_EVENT,
  ruleMatches,
  ruleMessage,
} from '@/lib/notifications/order-rules'

const order = { orderNumber: 'JMS-1042', status: 'CONFIRMED' as const, total: 150 }
const base = { isActive: true, statusFilter: null, minAmount: null }

describe('ruleMatches', () => {
  it('matches every order when no filter is set', () => {
    expect(ruleMatches(base, order)).toBe(true)
  })

  it('never matches an inactive rule', () => {
    expect(ruleMatches({ ...base, isActive: false }, order)).toBe(false)
  })

  it('applies the status filter', () => {
    expect(ruleMatches({ ...base, statusFilter: 'CONFIRMED' }, order)).toBe(true)
    expect(ruleMatches({ ...base, statusFilter: 'CANCELLED' }, order)).toBe(false)
  })

  it('treats minAmount as inclusive', () => {
    // A rule written for "$150 and up" that skipped a $150 order reads as broken.
    expect(ruleMatches({ ...base, minAmount: 150 as never }, order)).toBe(true)
  })

  it('rejects an order below minAmount', () => {
    expect(ruleMatches({ ...base, minAmount: 150.01 as never }, order)).toBe(false)
  })

  it('requires every filter to pass, not any', () => {
    const rule = { ...base, statusFilter: 'CONFIRMED' as const, minAmount: 200 as never }
    expect(ruleMatches(rule, order)).toBe(false)
  })
})

describe('ruleMessage', () => {
  it('names the event and the order in the subject', () => {
    const message = ruleMessage('ORDER_SHIPPED', order, 'https://example.test')
    expect(message.subject).toBe('Order shipped: JMS-1042 — $150.00')
  })

  it('links into the admin order list by order number', () => {
    const message = ruleMessage('ORDER_PAID', order, 'https://example.test')
    expect(message.html).toContain('https://example.test/admin/orders?search=JMS-1042')
  })

  it('keeps the two channels consistent', () => {
    const message = ruleMessage('PAYMENT_FAILED', order, 'https://example.test')
    expect(message.text).toContain('JMS-1042')
    expect(message.html).toContain('JMS-1042')
    expect(message.text).toContain('$150.00')
  })
})

describe('RULE_EVENT_BY_DOMAIN_EVENT', () => {
  it('lets one paid order satisfy both the paid and high-value triggers', () => {
    // "High value" is a threshold on the rule, not a different thing happening.
    expect(RULE_EVENT_BY_DOMAIN_EVENT['payment.completed']).toEqual([
      'ORDER_PAID',
      'HIGH_VALUE_ORDER',
    ])
  })

  it('does not map ORDER_CANCELLED, because nothing emits order.cancelled', () => {
    // A rule using it would sit in the table looking configured and never fire.
    const mapped = Object.values(RULE_EVENT_BY_DOMAIN_EVENT).flat()
    expect(mapped).not.toContain('ORDER_CANCELLED')
  })
})
