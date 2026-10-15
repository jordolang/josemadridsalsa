import { describe, expect, it } from 'vitest'
import {
  normalizePhone,
  orderLookupSchema,
  phoneMatchesOrder,
  smsSignupSchema,
  toE164,
} from '@/lib/order-tracking/lookup'

describe('normalizePhone', () => {
  it('reduces every common US format to the same ten digits', () => {
    for (const value of ['(740) 555-1234', '740.555.1234', '+1 740 555 1234', '17405551234']) {
      expect(normalizePhone(value)).toBe('7405551234')
    }
  })

  it('rejects numbers too short to be a full phone number', () => {
    expect(normalizePhone('555-1234')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('toE164', () => {
  it('formats a US number for sending', () => {
    expect(toE164('(740) 555-1234')).toBe('+17405551234')
  })

  it('returns null for an incomplete number', () => {
    expect(toE164('555-1234')).toBeNull()
  })
})

describe('phoneMatchesOrder', () => {
  it('matches any phone recorded on the order, ignoring formatting', () => {
    expect(phoneMatchesOrder('740-555-1234', [null, '+1 (740) 555-1234'])).toBe(true)
  })

  it('does not match a different number', () => {
    expect(phoneMatchesOrder('740-555-9999', ['740-555-1234'])).toBe(false)
  })

  it('never matches when the order has no phone', () => {
    expect(phoneMatchesOrder('740-555-1234', [null, undefined, ''])).toBe(false)
  })

  it('never matches a partial number, even if it is the tail of the real one', () => {
    expect(phoneMatchesOrder('1234', ['740-555-1234'])).toBe(false)
  })
})

describe('orderLookupSchema', () => {
  it('normalises an order number typed with a hash and lowercase', () => {
    const parsed = orderLookupSchema.parse({ method: 'order', orderNumber: ' #jms-1001 ', phone: '7405551234' })
    expect(parsed).toEqual({ method: 'order', orderNumber: 'JMS-1001', phone: '7405551234' })
  })

  it('strips spaces and dashes from a tracking number', () => {
    const parsed = orderLookupSchema.parse({ method: 'tracking', trackingNumber: '9400 1000-0000 0000' })
    expect(parsed).toEqual({ method: 'tracking', trackingNumber: '9400100000000000' })
  })

  it('rejects a tracking number with characters carriers never use', () => {
    expect(orderLookupSchema.safeParse({ method: 'tracking', trackingNumber: "1Z<script>'" }).success).toBe(false)
  })

  it('requires a phone with the order number', () => {
    expect(orderLookupSchema.safeParse({ method: 'order', orderNumber: 'JMS-1', phone: '' }).success).toBe(false)
  })
})

describe('smsSignupSchema', () => {
  const valid = { orderNumber: 'JMS-1', token: 'abc', phone: '740-555-1234', consent: true }

  it('accepts a full number with consent', () => {
    expect(smsSignupSchema.safeParse(valid).success).toBe(true)
  })

  it('requires the consent box', () => {
    expect(smsSignupSchema.safeParse({ ...valid, consent: false }).success).toBe(false)
  })

  it('rejects an incomplete number', () => {
    expect(smsSignupSchema.safeParse({ ...valid, phone: '555-1234' }).success).toBe(false)
  })
})
