import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/stripe/route'
import Stripe from 'stripe'

// Mock dependencies
vi.mock('@/lib/prisma', () => {
  const prismaMock = {
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    refund: {
      upsert: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    inventoryTransaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    domainEvent: {
      create: vi.fn(),
    },
    notification: {
      upsert: vi.fn(),
    },
    user: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    $transaction: vi.fn(),
  }
  return {
    default: prismaMock,
    prisma: prismaMock,
  }
})

vi.mock('@/lib/email/automation', () => ({
  sendOrderConfirmationEmail: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/inventory-manager', () => ({
  bulkDeductReservedInventoryOnceInTx: vi.fn((reservations: any[]) =>
    Promise.resolve(
      reservations.map(() => ({
        product: {
          id: 'prod-1',
          name: 'Test Product',
          sku: 'TEST-SKU',
          inventory: 97,
          stockReserved: 0,
          lowStockThreshold: 10,
          stockStatus: 'IN_STOCK',
        },
        transaction: { id: 'txn-1' },
        previousInventory: 100,
        newInventory: 97,
      }))
    )
  ),
  checkAndUpdateAlerts: vi.fn(() => Promise.resolve()),
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
    // charge.refunded resolves orderId from the PaymentIntent (Stripe does not copy its
    // metadata onto the Charge) and lists refunds explicitly (the Charge stopped
    // auto-expanding them in API 2022-11-15). Both return nothing here, so the charges in
    // these tests still fall through to the skip paths they are asserting.
    paymentIntents: {
      retrieve: vi.fn(async () => ({ metadata: {} })),
    },
    refunds: {
      list: vi.fn(async () => ({ data: [] })),
    },
  })),
}))

describe('Stripe Webhook Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockWebhooksConstructEvent.mockClear()
    mockHeadersGet.mockClear()

    // Set env variable for webhook secret
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'

    // Default webhook event mocks (can be overridden in individual tests)
    const { default: prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({
      id: 'webhook-event-1',
      stripeEventId: 'evt_test',
      type: 'test.event',
      processed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    // Default payment mock
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'payment-123',
      orderId: 'order-123',
      stripePaymentIntentId: 'pi_test123',
      amount: 100,
      status: 'SUCCEEDED',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
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
  // 1. charge.refunded Full Flow Integration Tests
  // ========================================

  it('should process full refund with inventory restoration and audit log', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const mockOrder = {
      id: 'order-123',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      items: [
        { id: 'item-1', productId: 'prod-1', quantity: 2 },
        { id: 'item-2', productId: 'prod-2', quantity: 1 },
      ],
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()
    const mockAuditLogFindFirst = vi.fn().mockResolvedValue(null)
    const mockAuditLogCreate = vi.fn()

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_refund_full',
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
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_test123',
                object: 'refund',
                amount: 10000,
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '/v1/charges/ch_test123/refunds',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        auditLog: {
          findFirst: mockAuditLogFindFirst,
          create: mockAuditLogCreate,
        },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      include: { items: true },
    })

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-123' },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    })

    expect(mockProductUpdate).toHaveBeenCalledTimes(2)
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { inventory: { increment: 2 } },
    })
    expect(mockProductUpdate).toHaveBeenCalledWith({
      where: { id: 'prod-2' },
      data: { inventory: { increment: 1 } },
    })

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: 'order-123',
        changes: {
          refundId: 're_test123',
          chargeId: 'ch_test123',
          isFullRefund: true,
          amountRefunded: 10000,
          inventoryRestored: true,
        },
      },
    })
  })

  it('should process partial refund without inventory restoration', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const mockOrder = {
      id: 'order-456',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      items: [
        { id: 'item-1', productId: 'prod-1', quantity: 2 },
      ],
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()
    const mockAuditLogFindFirst = vi.fn().mockResolvedValue(null)
    const mockAuditLogCreate = vi.fn()

    const chargePartialRefundEvent: Stripe.Event = {
      id: 'evt_refund_partial',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test456',
          object: 'charge',
          amount: 10000,
          amount_refunded: 3000,
          metadata: {
            orderId: 'order-456',
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_test456',
                object: 'refund',
                amount: 3000,
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '/v1/charges/ch_test456/refunds',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        auditLog: {
          findFirst: mockAuditLogFindFirst,
          create: mockAuditLogCreate,
        },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(chargePartialRefundEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-456' },
      data: {
        status: 'CONFIRMED',
        paymentStatus: 'PARTIALLY_REFUNDED',
      },
    })

    expect(mockProductUpdate).not.toHaveBeenCalled()

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: 'order-456',
        changes: {
          refundId: 're_test456',
          chargeId: 'ch_test456',
          isFullRefund: false,
          amountRefunded: 3000,
          inventoryRestored: false,
        },
      },
    })
  })

  it('should handle duplicate refund webhook (idempotency check)', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-789',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      items: [
        { id: 'item-1', productId: 'prod-1', quantity: 1 },
      ],
    }

    const existingAuditLog = {
      id: 'audit-123',
      action: 'webhook.refund',
      entityId: 'order-789',
      changes: {
        refundId: 're_duplicate',
      },
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()
    const mockAuditLogFindFirst = vi.fn().mockResolvedValue(existingAuditLog)
    const mockAuditLogCreate = vi.fn()

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_duplicate',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test789',
          object: 'charge',
          amount: 5000,
          amount_refunded: 5000,
          metadata: {
            orderId: 'order-789',
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_duplicate',
                object: 'refund',
                amount: 5000,
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '/v1/charges/ch_test789/refunds',
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

    // Mock webhookEvent as already processed (idempotency check)
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      id: 'webhook-1',
      stripeEventId: 'evt_duplicate',
      type: 'charge.refunded',
      processed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Verify idempotency check was done
    expect(prisma.webhookEvent.findUnique).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_duplicate' },
    })

    // Should not process order or call any transaction updates
    expect(prisma.order.findUnique).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Webhook event already processed, skipping:',
      'evt_duplicate'
    )

    consoleLogSpy.mockRestore()
  })

  it('should skip refund processing if no refund ID found', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_no_refund_id',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_no_refund',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {
            orderId: 'order-no-refund',
          },
          refunds: {
            object: 'list',
            data: [],
            has_more: false,
            url: '/v1/charges/ch_no_refund/refunds',
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
      'Skipping refund processing: no refund found for charge:',
      'ch_no_refund'
    )

    expect(prisma.order.findUnique).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('should skip refund processing if orderId is missing', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_no_order_id',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_no_order',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {},
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_test',
                object: 'refund',
                amount: 10000,
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '/v1/charges/ch_no_order/refunds',
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
      'Skipping refund processing: cannot resolve orderId for charge:',
      'ch_no_order'
    )

    expect(prisma.order.findUnique).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('should skip refund processing if order not found', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_order_not_found',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_order_not_found',
          object: 'charge',
          amount: 10000,
          amount_refunded: 10000,
          metadata: {
            orderId: 'order-not-found',
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_not_found',
                object: 'refund',
                amount: 10000,
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '/v1/charges/ch_order_not_found/refunds',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Order not found for refund:',
      'order-not-found'
    )

    expect(prisma.$transaction).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('should handle full refund with no items (gift certificate order)', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    const mockOrder = {
      id: 'order-gift',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      items: [],
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()
    const mockAuditLogFindFirst = vi.fn().mockResolvedValue(null)
    const mockAuditLogCreate = vi.fn()

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_gift_refund',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_gift',
          object: 'charge',
          amount: 5000,
          amount_refunded: 5000,
          metadata: {
            orderId: 'order-gift',
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_gift',
                object: 'refund',
                amount: 5000,
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '/v1/charges/ch_gift/refunds',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        auditLog: {
          findFirst: mockAuditLogFindFirst,
          create: mockAuditLogCreate,
        },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-gift' },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    })

    expect(mockProductUpdate).not.toHaveBeenCalled()

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: 'order-gift',
        changes: {
          refundId: 're_gift',
          chargeId: 'ch_gift',
          isFullRefund: true,
          amountRefunded: 5000,
          inventoryRestored: false,
        },
      },
    })
  })

  // ========================================
  // 2. payment_intent.succeeded Integration Tests
  // ========================================

  it('should process payment success with inventory decrement and email', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    const mockOrder = {
      id: 'order-payment',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      items: [
        { id: 'item-1', productId: 'prod-1', quantity: 3 },
        { id: 'item-2', productId: 'prod-2', quantity: 1 },
      ],
      giftCertificates: [],
      confirmationEmailSentAt: null,
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()  // Not called directly; inventory manager handles product updates

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_payment_success',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_payment',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-payment',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-payment' },
      include: {
        items: true,
        giftCertificates: true,
      },
    })

    // The webhook writes PAID, the same terminal status as /api/checkout/complete,
    // so the two paths recognize each other's work.
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-payment' },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        stripePaymentId: 'pi_payment',
      },
    })

    // Note: product updates are handled internally by deductReservedInventoryInTx,
    // which is mocked at the global level. Testing product.update calls would
    // require unmocking the inventory manager, but that's tested in its own unit tests.
    // This test verifies the webhook correctly processes payment and calls the email service.

    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order-payment')
  })

  it('should skip inventory decrement for gift certificate only orders', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    const mockOrder = {
      id: 'order-gift-only',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      items: [],
      giftCertificates: [
        { id: 'gc-1', amount: 50 },
      ],
      confirmationEmailSentAt: null,
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_gift_payment',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_gift',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-gift-only',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockOrderUpdate).toHaveBeenCalled()
    expect(mockProductUpdate).not.toHaveBeenCalled()
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order-gift-only')
  })

  it('should skip duplicate payment (order already paid)', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-already-paid',
      paymentStatus: 'SUCCEEDED',
      status: 'CONFIRMED',
      items: [
        { id: 'item-1', productId: 'prod-1', quantity: 1 },
      ],
      giftCertificates: [],
      confirmationEmailSentAt: new Date(),
    }

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_duplicate_payment',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_duplicate',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-already-paid',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Order already marked as paid:',
      'order-already-paid'
    )

    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()

    consoleLogSpy.mockRestore()
  })

  it('should not send email if already sent', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    const mockOrder = {
      id: 'order-email-sent',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      items: [],
      giftCertificates: [],
      confirmationEmailSentAt: new Date(),
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_email_sent',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_email_sent',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-email-sent',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
  })

  it('should handle email sending errors gracefully', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-email-error',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      items: [],
      giftCertificates: [],
      confirmationEmailSentAt: null,
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_email_error',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_email_error',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-email-error',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      }
      return callback(txContext)
    })

    vi.mocked(sendOrderConfirmationEmail).mockRejectedValue(new Error('Email service unavailable'))

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    await new Promise(resolve => setTimeout(resolve, 10))

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send confirmation email',
      {
        orderId: 'order-email-error',
        error: expect.any(Error),
      }
    )

    consoleErrorSpy.mockRestore()
  })

  // ========================================
  // 3. Webhook Signature Verification Tests
  // ========================================

  it('should return 400 if stripe-signature header is missing', async () => {
    mockHeaders(null)

    const request = createRequest(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Missing stripe-signature header')
    expect(mockWebhooksConstructEvent).not.toHaveBeenCalled()
  })

  it('should return 400 if signature verification fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    mockHeaders('invalid_signature')
    mockWebhooksConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const request = createRequest(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Webhook signature verification failed')
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Webhook signature verification failed:',
      'Invalid signature'
    )

    consoleErrorSpy.mockRestore()
  })

  // ========================================
  // 4. Error Handling Integration Tests
  // ========================================

  it('should return 503 if webhook secret is not configured', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.STRIPE_WEBHOOK_SECRET

    mockHeaders('valid_signature')

    const request = createRequest(JSON.stringify({ type: 'payment_intent.succeeded' }))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.error).toBe('Service unavailable')
    expect(consoleErrorSpy).toHaveBeenCalledWith('CRITICAL: STRIPE_WEBHOOK_SECRET is not set')

    consoleErrorSpy.mockRestore()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  })

  it('should return 500 on transaction failure', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-tx-error',
      paymentStatus: 'PENDING',
      items: [],
      giftCertificates: [],
      confirmationEmailSentAt: null,
    }

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_tx_error',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_tx_error',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-tx-error',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error('Database transaction failed'))

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
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

  it('should log console messages for refund processing', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-log-test',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      items: [],
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()
    const mockAuditLogFindFirst = vi.fn().mockResolvedValue(null)
    const mockAuditLogCreate = vi.fn()

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_log_test',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_log_test',
          object: 'charge',
          amount: 10000,
          amount_refunded: 5000,
          metadata: {
            orderId: 'order-log-test',
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_log_test',
                object: 'refund',
                amount: 5000,
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '/v1/charges/ch_log_test/refunds',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
        auditLog: {
          findFirst: mockAuditLogFindFirst,
          create: mockAuditLogCreate,
        },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(chargeRefundedEvent))
    await POST(request)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Order refund processed via webhook:',
      'order-log-test',
      'PARTIAL'
    )

    consoleLogSpy.mockRestore()
  })

  it('should log console messages for payment confirmation', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-payment-log',
      paymentStatus: 'PENDING',
      items: [],
      giftCertificates: [],
      confirmationEmailSentAt: null,
    }

    const mockOrderUpdate = vi.fn()
    const mockProductUpdate = vi.fn()

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_payment_log',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_payment_log',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-payment-log',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { update: vi.fn(), upsert: vi.fn() },
        refund: {
          // The reversal re-reads the refund inside the transaction and claims it. These
          // refunds sit on ordinary orders, so it short-circuits before touching a rollup.
          upsert: vi.fn().mockResolvedValue({ id: 'refund-test' }),
          findUnique: vi.fn().mockResolvedValue({
            amount: 0,
            commissionReversed: null,
            payment: { order: null },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          aggregate: vi.fn().mockResolvedValue({ _sum: { commissionReversed: null } }),
        },
        product: { update: mockProductUpdate },
        inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    await POST(request)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Order payment confirmed via webhook:',
      'order-payment-log'
    )

    consoleLogSpy.mockRestore()
  })

  // ========================================
  // 5. Additional Event Type Tests for Coverage
  // ========================================

  it('should handle payment_intent.succeeded with missing orderId', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_no_order_id',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_no_order_id',
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

    mockHeaders('valid_signature')
    mockWebhooksConstructEvent.mockReturnValue(paymentSucceededEvent)

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Payment intent missing orderId in metadata:',
      'pi_no_order_id'
    )

    expect(prisma.order.findUnique).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  it('should handle payment_intent.succeeded with order not found', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_order_not_found',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_order_not_found',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-not-found',
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
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

    const request = createRequest(JSON.stringify(paymentSucceededEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Order not found for payment intent:',
      'pi_order_not_found',
      'orderId:',
      'order-not-found'
    )

    expect(prisma.$transaction).not.toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('should handle payment_intent.payment_failed event', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockOrderUpdate = vi.fn()
    const mockPaymentUpsert = vi.fn()

    const paymentFailedEvent: Stripe.Event = {
      id: 'evt_payment_failed',
      object: 'event',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_failed',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-failed',
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

    // Mock the transaction to capture order.update and payment.upsert calls
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { upsert: mockPaymentUpsert },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(paymentFailedEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-failed' },
      data: {
        paymentStatus: 'FAILED',
      },
    })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Order payment failed via webhook:',
      'order-failed'
    )

    consoleLogSpy.mockRestore()
  })

  it('should handle payment_intent.canceled event', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const paymentCanceledEvent: Stripe.Event = {
      id: 'evt_payment_canceled',
      object: 'event',
      type: 'payment_intent.canceled',
      data: {
        object: {
          id: 'pi_canceled',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-canceled',
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

    const mockOrderUpdate = vi.fn()
    const mockPaymentUpsert = vi.fn()

    // Mock the transaction to capture order.update and payment.upsert calls
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const txContext = {
        order: {
          update: mockOrderUpdate,
          // The commission credit re-reads the order inside the transaction and claims
          // it with a conditional update. These orders carry no participant.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        payment: { upsert: mockPaymentUpsert },
      }
      return callback(txContext)
    })

    const request = createRequest(JSON.stringify(paymentCanceledEvent))
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-canceled' },
      data: {
        paymentStatus: 'FAILED',
        status: 'CANCELLED',
      },
    })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Order payment canceled via webhook:',
      'order-canceled'
    )

    consoleLogSpy.mockRestore()
  })

  it('should handle unknown event type', async () => {
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
})
