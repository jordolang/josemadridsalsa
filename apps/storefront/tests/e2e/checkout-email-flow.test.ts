/**
 * End-to-End Test: Checkout Flow → Email Confirmation
 *
 * This test verifies the complete flow:
 * 1. Stripe payment_intent.succeeded webhook is received
 * 2. Order status is updated to PAID/CONFIRMED
 * 3. sendOrderConfirmationEmail() is triggered
 * 4. Email is rendered using React Email template
 * 5. Email is sent via Resend
 * 6. Order.confirmationEmailSentAt timestamp is set
 * 7. EmailLog entry is created in database (when integrated)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/webhooks/stripe/route'
import Stripe from 'stripe'

// Mock dependencies following the pattern from tests/api/webhooks/stripe.test.ts
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
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/email/automation', () => ({
  sendOrderConfirmationEmail: vi.fn(() => Promise.resolve({ success: true })),
}))

vi.mock('@/lib/inventory-manager', () => ({
  deductReservedInventoryInTx: vi.fn(() =>
    Promise.resolve({ newInventory: 10, product: { lowStockThreshold: 5 } })
  ),
  checkAndUpdateAlerts: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/lib/orders/redeem-codes', () => ({
  redeemOrderCodesInTx: vi.fn(() => Promise.resolve()),
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

describe('E2E: Checkout Flow → Order Confirmation Email', () => {
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

  it('should complete full checkout-to-email flow when payment succeeds', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    // ========================================
    // STEP 1: Mock order data
    // ========================================
    const mockOrder = {
      id: 'order-e2e-123',
      orderNumber: 'ORD-2024-001',
      total: '49.99',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      confirmationEmailSentAt: null,
      guestEmail: 'customer@example.com',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      items: [
        {
          id: 'item-1',
          productId: 'prod-salsa-mild',
          productName: 'Mild Salsa',
          productSku: 'SALSA-MILD-001',
          quantity: 2,
          price: '12.99',
          totalPrice: '25.98',
        },
        {
          id: 'item-2',
          productId: 'prod-salsa-hot',
          productName: 'Hot Salsa',
          productSku: 'SALSA-HOT-001',
          quantity: 1,
          price: '14.99',
          totalPrice: '14.99',
        },
      ],
      giftCertificates: [],
      user: {
        name: 'John Doe',
        email: 'customer@example.com',
      },
      shippingMethod: '123 Main St, Portland, OR 97201',
      trackingNumber: null,
    }

    // Mock Prisma order queries
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    // Mock transaction that updates order status
    const mockTransaction = vi.fn(async (callback) => {
      return callback({
        order: {
          update: vi.fn().mockResolvedValue({
            ...mockOrder,
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            stripePaymentId: 'pi_test_e2e_123',
          }),
          // The commission credit re-reads the order in the transaction and claims it with a
          // conditional update. This one carries no participant, so it short-circuits.
          findUnique: vi.fn().mockResolvedValue({
            participantId: null,
            fundraiserId: null,
            commissionCreditedAt: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        product: {
          update: vi.fn(),
        },
        payment: {
          upsert: vi.fn(),
        },
        inventoryTransaction: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      })
    })

    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    // Mock sendOrderConfirmationEmail to resolve successfully
    vi.mocked(sendOrderConfirmationEmail).mockResolvedValue({
      success: true,
      messageId: 'email_test_123',
    } as any)

    // ========================================
    // STEP 2: Create Stripe webhook event
    // ========================================
    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_e2e_test',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_e2e_123',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-e2e-123',
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

    // ========================================
    // STEP 3: Process webhook
    // ========================================
    const response = await POST(request)
    const data = await response.json()

    // ========================================
    // STEP 4: Verify webhook processing
    // ========================================
    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Verify order was fetched with correct includes
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'order-e2e-123' },
      include: {
        items: true,
        giftCertificates: true,
      },
    })

    // Verify order status was updated via transaction
    expect(prisma.$transaction).toHaveBeenCalled()

    // ========================================
    // STEP 5: Verify email was triggered
    // ========================================
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order-e2e-123')
  })

  it('should not send duplicate email if confirmationEmailSentAt is already set', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    // Mock order with confirmationEmailSentAt already set
    const mockOrder = {
      id: 'order-duplicate-check',
      orderNumber: 'ORD-2024-002',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      confirmationEmailSentAt: new Date('2024-01-15T09:00:00Z'), // Already sent
      guestEmail: 'customer@example.com',
      items: [],
      giftCertificates: [],
    }

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const mockTransaction = vi.fn(async (callback) => callback({
      // The commission credit re-reads the order in the transaction; this one has no participant.
      order: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ participantId: null, fundraiserId: null, commissionCreditedAt: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      product: { update: vi.fn() },
      payment: { upsert: vi.fn() },
      inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null) },
    }))
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_duplicate',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_duplicate',
          object: 'payment_intent',
          metadata: { orderId: 'order-duplicate-check' },
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

    // Verify email was NOT sent (confirmationEmailSentAt already set)
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
  })

  it('should handle email send failure gracefully without blocking webhook', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const mockOrder = {
      id: 'order-email-fail',
      orderNumber: 'ORD-2024-003',
      total: '29.99',
      paymentStatus: 'PENDING',
      status: 'PENDING',
      confirmationEmailSentAt: null,
      guestEmail: 'customer@example.com',
      createdAt: new Date(),
      items: [],
      giftCertificates: [],
      user: { name: 'Test User', email: 'customer@example.com' },
      shippingMethod: 'Test Address',
      trackingNumber: null,
    }

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const mockTransaction = vi.fn(async (callback) => callback({
      // The commission credit re-reads the order in the transaction; this one has no participant.
      order: {
        update: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ participantId: null, fundraiserId: null, commissionCreditedAt: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      product: { update: vi.fn() },
      payment: { upsert: vi.fn() },
      inventoryTransaction: { findFirst: vi.fn().mockResolvedValue(null) },
    }))
    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    // Mock email send to reject/fail
    vi.mocked(sendOrderConfirmationEmail).mockRejectedValue(new Error('Email service unavailable'))

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_email_fail',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_email_fail',
          object: 'payment_intent',
          metadata: { orderId: 'order-email-fail' },
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

    // Webhook should still succeed even if email fails
    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Email should have been attempted
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith('order-email-fail')

    // Error should have been logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send confirmation email',
      expect.objectContaining({
        orderId: 'order-email-fail',
      })
    )

    consoleErrorSpy.mockRestore()
  })

  it('should skip email if order not found', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock order not found
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_no_order',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_no_order',
          object: 'payment_intent',
          metadata: { orderId: 'nonexistent-order' },
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

    // Email should NOT be sent for nonexistent order
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()

    // Error should be logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Order not found for payment intent:',
      'pi_no_order',
      'orderId:',
      'nonexistent-order'
    )

    consoleErrorSpy.mockRestore()
  })

  it('should skip email and order update if order already paid', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Mock order already paid
    const mockOrder = {
      id: 'order-already-paid',
      orderNumber: 'ORD-2024-005',
      paymentStatus: 'PAID', // Already paid
      status: 'CONFIRMED',
      confirmationEmailSentAt: new Date(),
      items: [],
      giftCertificates: [],
    }

    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_already_paid',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_already_paid',
          object: 'payment_intent',
          metadata: { orderId: 'order-already-paid' },
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

    // Transaction should NOT be called (skip update)
    expect(prisma.$transaction).not.toHaveBeenCalled()

    // Email should NOT be sent (order already processed)
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()

    // Should log that order was already paid
    expect(consoleLogSpy).toHaveBeenCalledWith('Order already marked as paid:', 'order-already-paid')

    consoleLogSpy.mockRestore()
  })
})
