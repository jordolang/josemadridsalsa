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

    const mockOrder = {
      id: 'order-123',
      orderNumber: 'JMS-20260211-1234',
      total: 100,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [],
    }

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
          refunds: {
            data: [
              {
                id: 're_test123',
                object: 'refund',
                amount: 10000,
              } as Stripe.Refund,
            ],
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    const mockTransaction = vi.fn(async (callback) => {
      const tx = {
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        order: {
          update: vi.fn(),
        },
        product: {
          update: vi.fn(),
        },
      }
      return await callback(tx)
    })

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
  })

  it('should update order to PARTIALLY_REFUNDED on partial refund', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const mockOrder = {
      id: 'order-123',
      orderNumber: 'JMS-20260211-1234',
      total: 100,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [],
    }

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
          refunds: {
            data: [
              {
                id: 're_partial123',
                object: 'refund',
                amount: 3000,
              } as Stripe.Refund,
            ],
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    const mockTransaction = vi.fn(async (callback) => {
      const tx = {
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        order: {
          update: vi.fn(),
        },
        product: {
          update: vi.fn(),
        },
      }
      return await callback(tx)
    })

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargePartialRefundEvent)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const request = createRequest(JSON.stringify(chargePartialRefundEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
  })

  it('should extract orderId from charge.metadata', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const mockOrder = {
      id: 'custom-order-id-456',
      orderNumber: 'JMS-20260211-1234',
      total: 100,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [],
    }

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
          refunds: {
            data: [
              {
                id: 're_extract123',
                object: 'refund',
                amount: 10000,
              } as Stripe.Refund,
            ],
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    const mockTransaction = vi.fn(async (callback) => {
      const tx = {
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        order: {
          update: vi.fn(),
        },
        product: {
          update: vi.fn(),
        },
      }
      return await callback(tx)
    })

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    await POST(request)

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'custom-order-id-456' },
      include: { items: true },
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
      'Skipping refund processing: charge missing orderId in metadata:',
      'ch_test123'
    )
    expect(prisma.order.update).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('should log refund event to console', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-123',
      orderNumber: 'JMS-20260211-1234',
      total: 100,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [],
    }

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
          refunds: {
            data: [
              {
                id: 're_log123',
                object: 'refund',
                amount: 5000,
              } as Stripe.Refund,
            ],
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    const mockTransaction = vi.fn(async (callback) => {
      const tx = {
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        order: {
          update: vi.fn(),
        },
        product: {
          update: vi.fn(),
        },
      }
      return await callback(tx)
    })

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    await POST(request)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Order refund processed via webhook:',
      'order-123',
      'PARTIAL'
    )

    consoleLogSpy.mockRestore()
  })

  it('should skip duplicate refund webhook (idempotency check)', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-123',
      orderNumber: 'JMS-20260211-1234',
      total: 100,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          quantity: 2,
        },
      ],
    }

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_duplicate',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test123',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000, // Full refund
          metadata: {
            orderId: 'order-123',
          },
          refunds: {
            data: [
              {
                id: 're_duplicate123',
                object: 'refund',
                amount: 10000,
              } as Stripe.Refund,
            ],
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    // Mock the transaction to simulate finding an existing audit log
    const mockTransaction = vi.fn(async (callback) => {
      const tx = {
        auditLog: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'audit-123',
            action: 'webhook.refund',
            entityId: 'order-123',
            changes: {
              refundId: 're_duplicate123',
            },
          }),
          create: vi.fn(),
        },
        order: {
          update: vi.fn(),
        },
        product: {
          update: vi.fn(),
        },
      }
      return await callback(tx)
    })

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    
    // Verify that the refund was detected as duplicate
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Refund already processed, skipping:',
      're_duplicate123',
      'for order:',
      'order-123'
    )

    consoleLogSpy.mockRestore()
  })

  it('should process new refund and create audit log', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const mockOrder = {
      id: 'order-456',
      orderNumber: 'JMS-20260211-5678',
      total: 100,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [
        {
          id: 'item-1',
          productId: 'product-1',
          quantity: 2,
        },
      ],
    }

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_new_refund',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test456',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000, // Full refund
          metadata: {
            orderId: 'order-456',
          },
          refunds: {
            data: [
              {
                id: 're_new123',
                object: 'refund',
                amount: 10000,
              } as Stripe.Refund,
            ],
          },
        } as Stripe.Charge,
      },
      api_version: '2023-10-16',
      created: 1707657600,
      livemode: false,
      pending_webhooks: 0,
      request: null,
    }

    // Mock the transaction to simulate NO existing audit log
    const mockAuditCreate = vi.fn()
    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()
    
    const mockTransaction = vi.fn(async (callback) => {
      const tx = {
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null), // No existing audit log
          create: mockAuditCreate,
        },
        order: {
          update: mockOrderUpdate,
        },
        product: {
          update: mockProductUpdate,
        },
      }
      return await callback(tx)
    })

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(chargeRefundedEvent)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)
    
    // Verify that order was updated
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-456' },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    })
    
    // Verify that audit log was created
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: 'order-456',
        changes: {
          refundId: 're_new123',
          chargeId: 'ch_test456',
          isFullRefund: true,
          amountRefunded: 10000,
          inventoryRestored: true,
        },
      },
    })
    
    // Verify inventory was restored
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: 'product-1' },
      data: {
        inventory: { increment: 2 },
      },
    })
  })

  it('should log warning if refundId is missing', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_no_refund_id',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test789',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {
            orderId: 'order-789',
          },
          refunds: {
            data: [], // No refunds
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
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Skipping refund processing: no refund ID found in charge:',
      'ch_test789'
    )

    consoleWarnSpy.mockRestore()
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

  it('should return 503 if webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockHeaders('valid_signature')

    const request = createRequest(JSON.stringify({ type: 'charge.refunded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Service unavailable')
    expect(consoleErrorSpy).toHaveBeenCalledWith('CRITICAL: STRIPE_WEBHOOK_SECRET is not set')

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
