/**
 * End-to-End Test: Refund Flow
 *
 * This test verifies the complete refund flow:
 * 1. Complete successful payment
 * 2. Call /api/admin/refunds with paymentId
 * 3. Verify Refund created in Stripe
 * 4. Verify Refund record in database
 * 5. Verify Payment status REFUNDED/PARTIALLY_REFUNDED
 * 6. Verify inventory restored if full refund
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as refundPOST } from '@/app/api/admin/refunds/route'
import { POST as webhookPOST } from '@/app/api/webhooks/stripe/route'
import Stripe from 'stripe'
import type { RefundRequest } from '@/lib/stripe/types'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    refund: {
      create: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/rbac', () => ({
  requirePermission: vi.fn(() =>
    Promise.resolve({ id: 'admin-user', email: 'admin@test.com', role: 'ADMIN' })
  ),
}))

const mockRefundsCreate = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    refunds: {
      create: mockRefundsCreate,
    },
    webhooks: {
      constructEvent: vi.fn((body, sig, secret) => {
        const event = JSON.parse(body)
        return event
      }),
    },
  })),
}))

const mockHeadersGet = vi.fn()

vi.mock('next/headers', () => ({
  headers: () => ({
    get: mockHeadersGet,
  }),
}))

describe('E2E: Refund Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefundsCreate.mockClear()
    mockHeadersGet.mockClear()

    // Set required env variables
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  })

  const mockHeaders = (signature: string | null) => {
    mockHeadersGet.mockImplementation((name: string) => {
      if (name === 'stripe-signature') return signature
      return null
    })
  }

  const createRequest = (body: unknown, method = 'POST') => {
    return {
      method,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    } as Request
  }

  it('should complete full refund flow from API call to webhook processing', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    // ========================================
    // STEP 1: Setup - Successful payment exists
    // ========================================
    const paymentId = 'payment-123'
    const orderId = 'order-123'
    const mockPayment = {
      id: paymentId,
      orderId: orderId,
      stripePaymentIntentId: 'pi_test_123',
      amount: 4999, // $49.99
      currency: 'usd',
      status: 'SUCCEEDED',
      paymentMethod: 'card',
      refunds: [], // No existing refunds
      createdAt: new Date(),
    }

    const mockOrder = {
      id: orderId,
      orderNumber: 'JMS-20260228-1234',
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [
        {
          id: 'item-1',
          productId: 'prod-salsa-mild',
          productName: 'Mild Salsa',
          quantity: 2,
        },
        {
          id: 'item-2',
          productId: 'prod-salsa-hot',
          productName: 'Hot Salsa',
          quantity: 1,
        },
      ],
    }

    const mockStripeRefund: Stripe.Refund = {
      id: 're_test_123',
      object: 'refund',
      amount: 4999,
      charge: 'ch_test_123',
      created: 1707657600,
      currency: 'usd',
      payment_intent: 'pi_test_123',
      status: 'succeeded',
      reason: null,
      metadata: {},
    }

    const mockRefundRecord = {
      id: 'refund-record-123',
      stripeRefundId: 're_test_123',
      amount: 4999,
      reason: undefined,
      status: 'SUCCEEDED',
      paymentId: paymentId,
      processedAt: new Date(),
      createdAt: new Date(),
    }

    // ========================================
    // STEP 2: Call /api/admin/refunds
    // ========================================
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment as any)
    mockRefundsCreate.mockResolvedValue(mockStripeRefund)
    vi.mocked(prisma.refund.create).mockResolvedValue(mockRefundRecord as any)
    vi.mocked(prisma.payment.update).mockResolvedValue({
      ...mockPayment,
      status: 'REFUNDED',
    } as any)

    const refundRequest: RefundRequest = {
      paymentId: paymentId,
      // No amount specified = full refund
    }

    // The refund route wraps its work in prisma.$transaction; pass the mocked
    // prisma as the transaction client so tx.* delegates to the mocked methods.
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma))

    const refundRequestObj = createRequest(refundRequest)
    const refundResponse = await refundPOST(refundRequestObj)
    const refundData = await refundResponse.json()

    // ========================================
    // STEP 3: Verify Refund created in Stripe
    // ========================================
    expect(refundResponse.status).toBe(200)
    expect(refundData.refundId).toBe('refund-record-123')
    expect(refundData.status).toBe('succeeded')

    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_test_123',
      amount: 4999, // Full refund amount
      reason: undefined,
    })

    // ========================================
    // STEP 4: Verify Refund record in database
    // ========================================
    expect(prisma.refund.create).toHaveBeenCalledWith({
      data: {
        stripeRefundId: 're_test_123',
        // Refunds record which processor they came from, so they can be attributed and
        // reported on — stripeRefundId is provider-agnostic despite its name.
        provider: 'STRIPE',
        amount: 4999,
        reason: undefined,
        status: 'SUCCEEDED',
        paymentId: paymentId,
        processedAt: expect.any(Date),
      },
    })

    // ========================================
    // STEP 5: Verify Payment status REFUNDED
    // ========================================
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: paymentId },
      data: { status: 'REFUNDED' }, // Full refund = REFUNDED
    })

    // ========================================
    // STEP 6: Simulate charge.refunded webhook
    // ========================================
    vi.clearAllMocks()

    // Mock webhook event check (no duplicate)
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({
      id: 'webhook-evt-refund',
      stripeEventId: 'evt_refund_123',
      type: 'charge.refunded',
      processed: false,
      createdAt: new Date(),
    } as any)
    vi.mocked(prisma.webhookEvent.update).mockResolvedValue({
      id: 'webhook-evt-refund',
      stripeEventId: 'evt_refund_123',
      type: 'charge.refunded',
      processed: true,
      createdAt: new Date(),
    } as any)

    // Mock order fetch for webhook
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    // Mock payment fetch for webhook
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: paymentId,
      orderId: orderId,
      stripePaymentIntentId: 'pi_test_123',
      amount: 4999,
      status: 'SUCCEEDED',
    } as any)

    // Mock AuditLog check (no duplicate refund processing)
    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)

    // Mock transaction that updates order, payment, refund and restores inventory
    const mockTransaction = vi.fn(async (callback) => {
      return callback({
        order: {
          update: vi.fn().mockResolvedValue({
            ...mockOrder,
            paymentStatus: 'REFUNDED',
            status: 'REFUNDED',
          }),
        },
        payment: {
          update: vi.fn().mockResolvedValue({
            id: paymentId,
            status: 'REFUNDED',
          }),
        },
        refund: {
          upsert: vi.fn().mockResolvedValue({
            id: 'refund-webhook-123',
            stripeRefundId: 're_test_123',
            amount: 4999,
            status: 'SUCCEEDED',
          }),
        },
        product: {
          update: vi.fn(),
        },
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 'audit-log-123',
            action: 'webhook.refund',
            entityType: 'order',
            entityId: orderId,
            changes: {
              refundId: 're_test_123',
              chargeId: 'ch_test_123',
              isFullRefund: true,
              amountRefunded: 4999,
              inventoryRestored: true,
            },
            createdAt: new Date(),
          }),
        },
      })
    })

    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    // Create charge.refunded webhook event
    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_refund_123',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test_123',
          object: 'charge',
          amount: 4999,
          amount_refunded: 4999, // Full refund
          metadata: {
            orderId: orderId,
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_test_123',
                amount: 4999,
                status: 'succeeded',
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '',
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

    const webhookRequest = createRequest(chargeRefundedEvent)
    const webhookResponse = await webhookPOST(webhookRequest)
    const webhookData = await webhookResponse.json()

    // ========================================
    // STEP 7: Verify webhook processing
    // ========================================
    expect(webhookResponse.status).toBe(200)
    expect(webhookData.received).toBe(true)

    // Verify WebhookEvent idempotency check
    expect(prisma.webhookEvent.findUnique).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_refund_123' },
    })

    // Verify order was fetched
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: orderId },
      include: { items: true },
    })

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled()

    // ========================================
    // STEP 8: Verify inventory restored (full refund)
    // ========================================
    // Get the transaction callback to verify what was called inside
    const transactionCallback = mockTransaction.mock.calls[0][0]
    const mockTx = {
      order: { update: vi.fn() },
      payment: { update: vi.fn() },
      refund: { upsert: vi.fn() },
      product: { update: vi.fn() },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    }
    await transactionCallback(mockTx)

    // Verify Order status updated to REFUNDED
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: {
        status: 'REFUNDED',
        paymentStatus: 'REFUNDED',
      },
    })

    // Verify inventory was restored for full refund
    expect(mockTx.product.update).toHaveBeenCalledTimes(2)
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-salsa-mild' },
      data: {
        inventory: { increment: 2 }, // Restore 2 units
      },
    })
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-salsa-hot' },
      data: {
        inventory: { increment: 1 }, // Restore 1 unit
      },
    })

    // Verify AuditLog entry created
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: orderId,
        changes: {
          refundId: 're_test_123',
          chargeId: 'ch_test_123',
          isFullRefund: true,
          amountRefunded: 4999,
          inventoryRestored: true,
        },
      },
    })

    // Verify webhook event marked as processed
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_refund_123' },
      data: { processed: true },
    })
  })

  it('should handle partial refund without restoring inventory', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    // ========================================
    // STEP 1: Setup - Successful payment exists
    // ========================================
    const paymentId = 'payment-partial-123'
    const orderId = 'order-partial-123'
    const mockPayment = {
      id: paymentId,
      orderId: orderId,
      stripePaymentIntentId: 'pi_test_partial',
      amount: 4999, // $49.99
      currency: 'usd',
      status: 'SUCCEEDED',
      refunds: [],
      createdAt: new Date(),
    }

    const mockOrder = {
      id: orderId,
      orderNumber: 'JMS-20260228-5678',
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [
        {
          id: 'item-1',
          productId: 'prod-salsa-mild',
          quantity: 2,
        },
      ],
    }

    const partialRefundAmount = 2000 // $20.00 (partial refund)

    const mockStripeRefund: Stripe.Refund = {
      id: 're_test_partial',
      object: 'refund',
      amount: partialRefundAmount,
      charge: 'ch_test_partial',
      created: 1707657600,
      currency: 'usd',
      payment_intent: 'pi_test_partial',
      status: 'succeeded',
      reason: 'requested_by_customer',
      metadata: {},
    }

    const mockRefundRecord = {
      id: 'refund-record-partial',
      stripeRefundId: 're_test_partial',
      amount: partialRefundAmount,
      reason: 'requested_by_customer',
      status: 'SUCCEEDED',
      paymentId: paymentId,
      processedAt: new Date(),
      createdAt: new Date(),
    }

    // ========================================
    // STEP 2: Call /api/admin/refunds with partial amount
    // ========================================
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment as any)
    mockRefundsCreate.mockResolvedValue(mockStripeRefund)
    vi.mocked(prisma.refund.create).mockResolvedValue(mockRefundRecord as any)
    vi.mocked(prisma.payment.update).mockResolvedValue({
      ...mockPayment,
      status: 'PARTIALLY_REFUNDED',
    } as any)

    const refundRequest: RefundRequest = {
      paymentId: paymentId,
      amount: partialRefundAmount,
      reason: 'requested_by_customer',
    }

    // The refund route wraps its work in prisma.$transaction; pass the mocked
    // prisma as the transaction client so tx.* delegates to the mocked methods.
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma))

    const refundRequestObj = createRequest(refundRequest)
    const refundResponse = await refundPOST(refundRequestObj)
    const refundData = await refundResponse.json()

    // ========================================
    // STEP 3: Verify partial refund created
    // ========================================
    expect(refundResponse.status).toBe(200)
    expect(refundData.refundId).toBe('refund-record-partial')
    expect(refundData.status).toBe('succeeded')

    expect(mockRefundsCreate).toHaveBeenCalledWith({
      payment_intent: 'pi_test_partial',
      amount: partialRefundAmount,
      reason: 'requested_by_customer',
    })

    // ========================================
    // STEP 4: Verify Payment status PARTIALLY_REFUNDED
    // ========================================
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: paymentId },
      data: { status: 'PARTIALLY_REFUNDED' }, // Partial refund = PARTIALLY_REFUNDED
    })

    // ========================================
    // STEP 5: Simulate charge.refunded webhook (partial)
    // ========================================
    vi.clearAllMocks()

    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({
      id: 'webhook-evt-partial',
      stripeEventId: 'evt_partial_123',
      type: 'charge.refunded',
      processed: false,
      createdAt: new Date(),
    } as any)
    vi.mocked(prisma.webhookEvent.update).mockResolvedValue({
      id: 'webhook-evt-partial',
      stripeEventId: 'evt_partial_123',
      type: 'charge.refunded',
      processed: true,
      createdAt: new Date(),
    } as any)

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    // Mock payment fetch for webhook
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: paymentId,
      orderId: orderId,
      stripePaymentIntentId: 'pi_test_partial',
      amount: 4999,
      status: 'SUCCEEDED',
    } as any)

    vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)

    const mockTransaction = vi.fn(async (callback) => {
      return callback({
        order: {
          update: vi.fn().mockResolvedValue({
            ...mockOrder,
            paymentStatus: 'PARTIALLY_REFUNDED',
          }),
        },
        payment: {
          update: vi.fn().mockResolvedValue({
            id: paymentId,
            status: 'PARTIALLY_REFUNDED',
          }),
        },
        refund: {
          upsert: vi.fn().mockResolvedValue({
            id: 'refund-webhook-partial',
            stripeRefundId: 're_test_partial',
            amount: partialRefundAmount,
            status: 'SUCCEEDED',
          }),
        },
        product: {
          update: vi.fn(),
        },
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
      })
    })

    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_partial_123',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test_partial',
          object: 'charge',
          amount: 4999,
          amount_refunded: partialRefundAmount, // Partial refund
          metadata: {
            orderId: orderId,
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: 're_test_partial',
                amount: partialRefundAmount,
                status: 'succeeded',
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '',
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

    const webhookRequest = createRequest(chargeRefundedEvent)
    const webhookResponse = await webhookPOST(webhookRequest)

    expect(webhookResponse.status).toBe(200)

    // ========================================
    // STEP 6: Verify inventory NOT restored (partial refund)
    // ========================================
    const transactionCallback = mockTransaction.mock.calls[0][0]
    const mockTx = {
      order: { update: vi.fn() },
      payment: { update: vi.fn() },
      refund: { upsert: vi.fn() },
      product: { update: vi.fn() },
      auditLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    }
    await transactionCallback(mockTx)

    // Verify Order status NOT changed to REFUNDED (remains CONFIRMED)
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED', // NOT changed because partial refund
        paymentStatus: 'PARTIALLY_REFUNDED',
      },
    })

    // Verify inventory was NOT restored (partial refund)
    expect(mockTx.product.update).not.toHaveBeenCalled()

    // Verify AuditLog entry created with inventoryRestored: false
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: orderId,
        changes: {
          refundId: 're_test_partial',
          chargeId: 'ch_test_partial',
          isFullRefund: false,
          amountRefunded: partialRefundAmount,
          inventoryRestored: false,
        },
      },
    })
  })

  it('should prevent refunding more than available amount', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    // ========================================
    // STEP 1: Setup - Payment with existing refund
    // ========================================
    const paymentId = 'payment-over-refund'
    const mockPayment = {
      id: paymentId,
      orderId: 'order-over-refund',
      stripePaymentIntentId: 'pi_test_over',
      amount: 5000, // $50.00
      currency: 'usd',
      status: 'SUCCEEDED',
      refunds: [
        {
          id: 'refund-existing',
          stripeRefundId: 're_existing',
          amount: 3000, // $30.00 already refunded
          status: 'SUCCEEDED',
        },
      ],
      createdAt: new Date(),
    }

    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment as any)

    // ========================================
    // STEP 2: Try to refund more than available
    // ========================================
    const refundRequest: RefundRequest = {
      paymentId: paymentId,
      amount: 2500, // Try to refund $25.00, but only $20.00 available
    }

    // The refund route wraps its work in prisma.$transaction; pass the mocked
    // prisma as the transaction client so tx.* delegates to the mocked methods.
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma))

    const refundRequestObj = createRequest(refundRequest)
    const refundResponse = await refundPOST(refundRequestObj)
    const refundData = await refundResponse.json()

    // ========================================
    // STEP 3: Verify error response
    // ========================================
    expect(refundResponse.status).toBe(400)
    expect(refundData.error).toContain('Cannot refund 2500 cents')
    expect(refundData.error).toContain('2000 cents available')

    // Verify Stripe refund was NOT called
    expect(mockRefundsCreate).not.toHaveBeenCalled()

    // Verify database refund was NOT created
    expect(prisma.refund.create).not.toHaveBeenCalled()
  })

  it('should prevent refunding already refunded payment', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    // ========================================
    // STEP 1: Setup - Payment with FAILED status
    // ========================================
    const paymentId = 'payment-failed'
    const mockPayment = {
      id: paymentId,
      orderId: 'order-failed',
      stripePaymentIntentId: 'pi_test_failed',
      amount: 5000,
      currency: 'usd',
      status: 'FAILED', // Cannot refund failed payment
      refunds: [],
      createdAt: new Date(),
    }

    vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPayment as any)

    // ========================================
    // STEP 2: Try to refund failed payment
    // ========================================
    const refundRequest: RefundRequest = {
      paymentId: paymentId,
    }

    // The refund route wraps its work in prisma.$transaction; pass the mocked
    // prisma as the transaction client so tx.* delegates to the mocked methods.
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma))

    const refundRequestObj = createRequest(refundRequest)
    const refundResponse = await refundPOST(refundRequestObj)
    const refundData = await refundResponse.json()

    // ========================================
    // STEP 3: Verify error response
    // ========================================
    expect(refundResponse.status).toBe(400)
    expect(refundData.error).toBe('Can only refund successful payments')

    // Verify Stripe refund was NOT called
    expect(mockRefundsCreate).not.toHaveBeenCalled()
  })

  it('should create AuditLog entry when processing refund webhook', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    // ========================================
    // STEP 1: Setup - Successful payment with refund
    // ========================================
    const orderId = 'order-audit-log'
    const refundId = 're_audit_test'

    const mockOrder = {
      id: orderId,
      orderNumber: 'JMS-20260228-9999',
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      items: [],
    }

    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({
      id: 'webhook-evt-audit',
      stripeEventId: 'evt_audit_test',
      type: 'charge.refunded',
      processed: false,
      createdAt: new Date(),
    } as any)
    vi.mocked(prisma.webhookEvent.update).mockResolvedValue({
      id: 'webhook-evt-audit',
      stripeEventId: 'evt_audit_test',
      type: 'charge.refunded',
      processed: true,
      createdAt: new Date(),
    } as any)

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    // Mock payment fetch for webhook
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: 'payment-audit-123',
      orderId: orderId,
      stripePaymentIntentId: 'pi_audit_test',
      amount: 4999,
      status: 'SUCCEEDED',
    } as any)

    const mockTransaction = vi.fn(async (callback) => {
      return callback({
        order: { update: vi.fn() },
        payment: { update: vi.fn() },
        refund: { upsert: vi.fn() },
        product: { update: vi.fn() },
        auditLog: {
          create: vi.fn().mockResolvedValue({
            id: 'audit-log-created',
            action: 'webhook.refund',
            entityType: 'order',
            entityId: orderId,
            changes: {
              refundId,
              chargeId: 'ch_audit_test',
              isFullRefund: true,
              amountRefunded: 4999,
              inventoryRestored: false,
            },
            createdAt: new Date(),
          }),
        },
      })
    })

    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    // ========================================
    // STEP 2: Simulate charge.refunded webhook
    // ========================================
    const chargeRefundedEvent: Stripe.Event = {
      id: 'evt_audit_test',
      object: 'event',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_audit_test',
          object: 'charge',
          amount: 4999,
          amount_refunded: 4999,
          metadata: {
            orderId: orderId,
          },
          refunds: {
            object: 'list',
            data: [
              {
                id: refundId,
                amount: 4999,
                status: 'succeeded',
              } as Stripe.Refund,
            ],
            has_more: false,
            url: '',
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

    const webhookRequest = createRequest(chargeRefundedEvent)
    const webhookResponse = await webhookPOST(webhookRequest)

    // ========================================
    // STEP 3: Verify AuditLog entry created
    // ========================================
    expect(webhookResponse.status).toBe(200)

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled()

    // Execute the transaction callback to verify AuditLog creation
    const transactionCallback = mockTransaction.mock.calls[0][0]
    const mockTx = {
      order: { update: vi.fn() },
      payment: { update: vi.fn() },
      refund: { upsert: vi.fn() },
      product: { update: vi.fn() },
      auditLog: {
        create: vi.fn(),
      },
    }

    await transactionCallback(mockTx)

    // Verify AuditLog entry was created to track the refund
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: orderId,
        changes: {
          refundId,
          chargeId: 'ch_audit_test',
          isFullRefund: true,
          amountRefunded: 4999,
          inventoryRestored: false, // No items to restore
        },
      },
    })
  })
})
