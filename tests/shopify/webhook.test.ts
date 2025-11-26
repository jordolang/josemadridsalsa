import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import {
  mapShopifyFinancialStatusToPrisma,
  mapShopifyFulfillmentStatusToPrisma,
  verifyShopifySignature,
} from '@/lib/shopify/webhook'

describe('Shopify webhook utilities', () => {
  it('verifies webhook signatures using the shared secret', () => {
    const payload = Buffer.from(JSON.stringify({ id: 1 }))
    const secret = 'test-secret'
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64')

    expect(verifyShopifySignature(payload, signature, secret)).toBe(true)
    expect(verifyShopifySignature(payload, 'invalid', secret)).toBe(false)
  })

  it('maps Shopify statuses to Prisma enums', () => {
    expect(mapShopifyFinancialStatusToPrisma('paid')).toBe('PAID')
    expect(mapShopifyFinancialStatusToPrisma('refunded')).toBe('REFUNDED')
    expect(mapShopifyFinancialStatusToPrisma(undefined)).toBe('PENDING')

    expect(mapShopifyFulfillmentStatusToPrisma('fulfilled')).toBe('SHIPPED')
    expect(mapShopifyFulfillmentStatusToPrisma('cancelled')).toBe('CANCELLED')
    expect(mapShopifyFulfillmentStatusToPrisma(undefined)).toBe('PENDING')
  })
})
