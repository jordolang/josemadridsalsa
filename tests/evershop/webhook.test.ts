import { describe, expect, it } from 'vitest'
import crypto from 'crypto'
import {
  mapEverShopPaymentStatusToPrisma,
  mapEverShopStatusToPrisma,
  parseWebhookDate,
  verifyEverShopSignature,
} from '@/lib/evershop/webhook'

describe('EverShop webhook utilities', () => {
  it('verifies signatures with matching secret', () => {
    const payload = JSON.stringify({ orderNumber: 'JMS-2024-0001' })
    const secret = 'test-secret'
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')

    expect(verifyEverShopSignature(payload, signature, secret)).toBe(true)
    expect(verifyEverShopSignature(payload, 'invalid', secret)).toBe(false)
  })

  it('maps status and payment values to Prisma enums', () => {
    expect(mapEverShopStatusToPrisma('shipped')).toBe('SHIPPED')
    expect(mapEverShopStatusToPrisma(undefined)).toBe('PENDING')
    expect(mapEverShopPaymentStatusToPrisma('paid')).toBe('PAID')
    expect(mapEverShopPaymentStatusToPrisma(undefined)).toBe('PENDING')
  })

  it('parses webhook dates safely', () => {
    const isoString = '2024-01-15T10:00:00Z'
    expect(parseWebhookDate(isoString)?.toISOString()).toBe(new Date(isoString).toISOString())
    expect(parseWebhookDate('not-a-date')).toBeUndefined()
    expect(parseWebhookDate()).toBeUndefined()
  })
})
