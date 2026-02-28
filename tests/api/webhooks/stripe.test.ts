import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/stripe/route'
import Stripe from 'stripe'

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
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/email/automation', () => ({
  sendOrderConfirmationEmail: vi.fn(() => Promise.resolve()),
}))

const mockHeadersGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: () => ({
    get: mockHeadersGet,
  }),
}))

const mockWebhooksConstructEvent = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: mockWebhooksConstructEvent,
    },
  })),
}))

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWebhooksConstructEvent.mockClear()
    mockHeadersGet.mockClear()

    // Set env variable for webhook secret
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  })

  const mockHeaders = (signature: string | null) => {
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === 'stripe-signature') return signature
      return null
    })
  }

  const createRequest = (body: string) => {
    return {
      text: () => Promise.resolve(body),
    } as Request
  }

  // ========================================
  // 1. charge.refunded Event Handler Tests
  // ========================================

  it('should update order to REFUNDED on full refund', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_test123',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000, // $100
          amount_refunded: 10000, // Fully refunded
          metadata: {
            orderId: 'order-123',
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    })
  })

  it('should update order to PARTIALLY_REFUNDED on partial refund', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const chargePartialRefundEvent: Stripe.Event = {
      id: 'evt_test456',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000, // $100
          amount_refunded: 3000, // $30 refunded
          metadata: {
            orderId: 'order-123',
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargePartialRefundEvent)

    const request = createRequest(JSON.stringify(chargePartialRefundEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      data: {
        paymentStatus: 'PARTIALLY_REFUNDED',
      },
    })
  })

  it('should extract orderId from charge.metadata', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_test789',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {
            orderId: 'custom-order-id-456',
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    await POST(request)

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'custom-order-id-456' },
      data: expect.anything(),
    })
  })

  it('should log warning and return 200 if orderId missing', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_test000',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {}, // No orderId
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Charge missing orderId in metadata:',
      'ch_test123'
    )
    expect(prisma.order.update).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('should log refund event to console', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_test111',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000,
          amount_refunded: 5000, // Partial refund
          metadata: {
            orderId: 'order-123',
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    await POST(request)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Order partially refunded via webhook:',
      'order-123'
    )

    consoleLogSpy.mockRestore()
  })

  // ========================================
  // 2. Webhook Signature Verification Tests
  // ========================================

  it('should return 400 if stripe-signature header is missing', async () => {
    mockHeaders(null) // No signature header

    const request = createRequest(JSON.stringify({ type: 'charge.refunded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing stripe-signature header')
    expect(mockWebhooksConstructEvent).not.toHaveBeenCalled()
  })

  it('should return 400 if signature is invalid', async () => {
    mockHeaders('invalid_signature')
    mockWebhooksConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const request = createRequest(JSON.stringify({ type: 'charge.refunded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Webhook signature verification failed')
  })

  it('should return 400 if webhook secret is incorrect', async () => {
    mockHeaders('wrong_signature')
    mockWebhooksConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    const request = createRequest(JSON.stringify({ type: 'charge.refunded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Webhook signature verification failed')
  })

  it('should process event successfully with valid signature', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_test222',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {
            orderId: 'order-123',
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockWebhooksConstructEvent).toHaveBeenCalled()
  })

  // ========================================
  // 3. Existing Event Handler Tests (Regression)
  // ========================================

  it('should handle payment_intent.succeeded event correctly', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    const mockOrder = {
      id: 'order-123',
      paymentStatus: 'PENDING',
      items: [{ id: 'item-1', productId: 'prod-1', quantity: 2 }],
      giftCertificates: [],
      confirmationEmailSentAt: null,
    }

    const mockTransaction = vi.fn(async (callback) => {
      return callback({
        order: {
          update: vi.fn(),
        },
        product: {
          update: vi.fn(),
        },
      })
    })

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_payment_succeeded',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test123',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-123',
          },
        } as Stripe.PaymentIntent,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(paymentSucceededEvent)

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      include: {
        items: true,
        giftCertificates: true,
      },
    })
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order-123')
  })

  it('should handle payment_intent.payment_failed event correctly', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const paymentFailedEvent: Stripe.Event = {
      id: 'evt_payment_failed',
      object: 'event',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test456',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-456',
          },
        } as Stripe.PaymentIntent,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(paymentFailedEvent)

    const request = createRequest(JSON.stringify(paymentFailedEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-456' },
      data: {
        paymentStatus: 'FAILED',
      },
    })
  })

  it('should handle payment_intent.canceled event correctly', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const paymentCanceledEvent: Stripe.Event = {
      id: 'evt_payment_canceled',
      object: 'event',
      type: 'payment_intent.canceled',
      data: {
        object: {
          id: 'pi_test789',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-789',
          },
        } as Stripe.PaymentIntent,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(paymentCanceledEvent)

    const request = createRequest(JSON.stringify(paymentCanceledEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-789' },
      data: {
        paymentStatus: 'FAILED',
        status: 'CANCELLED',
      },
    })
  })

  // ========================================
  // 4. Edge Case Tests
  // ========================================

  it('should handle duplicate webhook delivery (idempotency)', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_duplicate',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {
            orderId: 'order-123',
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)

    // First webhook delivery
    const request1 = createRequest(JSON.stringify(chargeRefundedEvent))
    const response1 = await POST(request1)
    expect(response1.status).toBe(200)

    // Duplicate webhook delivery
    const request2 = createRequest(JSON.stringify(chargeRefundedEvent))
    const response2 = await POST(request2)
    expect(response2.status).toBe(200)

    // Should be called twice (Prisma will handle duplicate updates)
    expect(prisma.order.update).toHaveBeenCalledTimes(2)
  })

  it('should handle invalid order ID in metadata gracefully', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_invalid_order',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test999',
          object: 'payment_intent',
          metadata: {
            orderId: 'invalid-order-id',
          },
        } as Stripe.PaymentIntent,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(paymentSucceededEvent)

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Order not found for payment intent:',
      'pi_test999',
      'orderId:',
      'invalid-order-id'
    )

    consoleErrorSpy.mockRestore()
  })

  it('should return 200 with log for unknown event type', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const unknownEvent: Stripe.Event = {
      id: 'evt_unknown',
      object: 'event',
      type: 'unknown.event.type' as any,
      data: {
        object: {} as any,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(unknownEvent)

    const request = createRequest(JSON.stringify(unknownEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    expect(consoleLogSpy).toHaveBeenCalledWith('Unhandled event type: unknown.event.type')

    consoleLogSpy.mockRestore()
  })

  it('should return 500 if webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockHeaders('valid_signature')

    const request = createRequest(JSON.stringify({ type: 'charge.refunded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Webhook secret not configured')
    expect(consoleErrorSpy).toHaveBeenCalledWith('STRIPE_WEBHOOK_SECRET is not set')

    consoleErrorSpy.mockRestore()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  })

  it('should return 500 if webhook processing encounters unexpected error', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(prisma.order.update).mockRejectedValue(new Error('Database connection lost'))

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_error',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {
            orderId: 'order-123',
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Webhook processing failed')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error processing webhook:',
      expect.any(Error)
    )

    consoleErrorSpy.mockRestore()
  })
})
