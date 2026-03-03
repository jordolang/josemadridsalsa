import { describe, expect, it, vi, beforeEach } from 'vitest'
import Stripe from 'stripe'
import { verifyWebhookSignature, processWebhookEvent } from '@/lib/stripe/webhooks'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/email/automation', () => ({
  sendOrderConfirmationEmail: vi.fn(() => Promise.resolve()),
}))

describe('Stripe webhook utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('verifyWebhookSignature', () => {
    it('verifies valid webhook signature', () => {
      const mockStripe = {
        webhooks: {
          constructEvent: vi.fn((body, sig, secret) => {
            return {
              id: 'evt_test',
              type: 'payment_intent.succeeded',
              data: { object: {} },
            } as Stripe.Event
          }),
        },
      } as unknown as Stripe

      const body = JSON.stringify({ id: 'evt_test' })
      const signature = 't=1234567890,v1=signature'
      const secret = 'whsec_test'

      const event = verifyWebhookSignature(body, signature, secret, mockStripe)

      expect(event).toBeDefined()
      expect(event.id).toBe('evt_test')
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(body, signature, secret)
    })

    it('throws error on invalid signature', () => {
      const mockStripe = {
        webhooks: {
          constructEvent: vi.fn(() => {
            throw new Error('Invalid signature')
          }),
        },
      } as unknown as Stripe

      const body = JSON.stringify({ id: 'evt_test' })
      const signature = 'invalid_signature'
      const secret = 'whsec_test'

      expect(() => verifyWebhookSignature(body, signature, secret, mockStripe)).toThrow(
        'Webhook signature verification failed: Invalid signature'
      )
    })

    it('throws error on missing secret', () => {
      const mockStripe = {
        webhooks: {
          constructEvent: vi.fn(() => {
            throw new Error('No signatures found matching the expected signature')
          }),
        },
      } as unknown as Stripe

      const body = JSON.stringify({ id: 'evt_test' })
      const signature = 't=1234567890,v1=signature'
      const secret = 'wrong_secret'

      expect(() => verifyWebhookSignature(body, signature, secret, mockStripe)).toThrow(
        'Webhook signature verification failed'
      )
    })
  })

  describe('processWebhookEvent', () => {
    it('routes payment_intent.succeeded events to handler', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const mockOrder = {
        id: 'order-123',
        paymentStatus: 'PAID',
        items: [],
        giftCertificates: [],
        confirmationEmailSentAt: new Date(),
      }

      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            object: 'payment_intent',
            metadata: { orderId: 'order-123' },
          } as Stripe.PaymentIntent,
        },
        api_version: '2023-10-16',
        created: 1707657600,
        livemode: false,
        pending_webhooks: 0,
        request: null,
      }

      const result = await processWebhookEvent(event)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Order already paid')
    })

    it('routes payment_intent.payment_failed events to handler', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.order.update).mockResolvedValue({} as any)

      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_test',
            object: 'payment_intent',
            metadata: { orderId: 'order-123' },
          } as Stripe.PaymentIntent,
        },
        api_version: '2023-10-16',
        created: 1707657600,
        livemode: false,
        pending_webhooks: 0,
        request: null,
      }

      const result = await processWebhookEvent(event)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Payment failure recorded')
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: { paymentStatus: 'FAILED' },
      })
    })

    it('routes payment_intent.canceled events to handler', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      vi.mocked(prisma.order.update).mockResolvedValue({} as any)

      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'payment_intent.canceled',
        data: {
          object: {
            id: 'pi_test',
            object: 'payment_intent',
            metadata: { orderId: 'order-123' },
          } as Stripe.PaymentIntent,
        },
        api_version: '2023-10-16',
        created: 1707657600,
        livemode: false,
        pending_webhooks: 0,
        request: null,
      }

      const result = await processWebhookEvent(event)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Payment cancellation recorded')
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-123' },
        data: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
        },
      })
    })

    it('routes charge.refunded events to handler', async () => {
      const { default: prisma } = await import('@/lib/prisma')

      const mockOrder = {
        id: 'order-123',
        paymentStatus: 'PAID',
        items: [],
      }

      const mockTransaction = vi.fn(async (callback) => {
        return callback({
          order: { update: vi.fn() },
          product: { update: vi.fn() },
          auditLog: { findFirst: vi.fn(), create: vi.fn() },
        })
      })

      vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_test',
            object: 'charge',
            amount: 10000,
            amount_refunded: 10000,
            metadata: { orderId: 'order-123' },
            refunds: {
              data: [{ id: 'ref_test' }],
            },
          } as Stripe.Charge,
        },
        api_version: '2023-10-16',
        created: 1707657600,
        livemode: false,
        pending_webhooks: 0,
        request: null,
      }

      const result = await processWebhookEvent(event)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Refund processed successfully')
    })

    it('returns success for unhandled event types', async () => {
      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'customer.created' as any,
        data: { object: {} as any },
        api_version: '2023-10-16',
        created: 1707657600,
        livemode: false,
        pending_webhooks: 0,
        request: null,
      }

      const result = await processWebhookEvent(event)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Event type not handled')
    })

    it('handles missing orderId gracefully', async () => {
      const event: Stripe.Event = {
        id: 'evt_test',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            object: 'payment_intent',
            metadata: {},
          } as Stripe.PaymentIntent,
        },
        api_version: '2023-10-16',
        created: 1707657600,
        livemode: false,
        pending_webhooks: 0,
        request: null,
      }

      const result = await processWebhookEvent(event)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Missing orderId in metadata')
    })
  })
})
