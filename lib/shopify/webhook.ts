import crypto from 'crypto'
import type { OrderStatus, PaymentStatus } from '@prisma/client'

const FULFILLMENT_STATUS_MAP: Record<string, OrderStatus> = {
  fulfilled: 'SHIPPED',
  partial: 'PROCESSING',
  restocked: 'PROCESSING',
  cancelled: 'CANCELLED',
}

const FINANCIAL_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: 'PENDING',
  authorized: 'PENDING',
  partially_paid: 'PENDING',
  paid: 'PAID',
  partially_refunded: 'PARTIALLY_REFUNDED',
  refunded: 'REFUNDED',
  voided: 'FAILED',
}

export function getShopifyWebhookSecret(): string {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('SHOPIFY_WEBHOOK_SECRET is not configured')
  }
  return secret
}

export function verifyShopifySignature(
  payload: Buffer | string,
  signature: string | null,
  secret: string = getShopifyWebhookSecret()
): boolean {
  if (!signature) {
    return false
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64')

  const expectedBuffer = Buffer.from(expected, 'utf8')
  const providedBuffer = Buffer.from(signature, 'utf8')

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

export function mapShopifyFulfillmentStatusToPrisma(status?: string | null): OrderStatus {
  if (!status) {
    return 'PENDING'
  }
  return FULFILLMENT_STATUS_MAP[status.toLowerCase()] || 'PENDING'
}

export function mapShopifyFinancialStatusToPrisma(status?: string | null): PaymentStatus {
  if (!status) {
    return 'PENDING'
  }
  return FINANCIAL_STATUS_MAP[status.toLowerCase()] || 'PENDING'
}

export function parseShopifyDate(value?: string | null): Date | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
