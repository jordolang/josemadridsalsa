/**
 * End-to-End Test: Checkout Session Flow
 *
 * This test verifies the complete Stripe Checkout Session flow:
 * 1. Create order via checkout
 * 2. Call /api/checkout/create-session
 * 3. Verify Stripe session created
 * 4. Simulate successful payment webhook
 * 5. Verify Payment record SUCCEEDED
 * 6. Verify Order status PAID
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as createSessionPOST } from '@/app/api/checkout/create-session/route'
import { POST as webhookPOST } from '@/app/api/webhooks/stripe/route'
import Stripe from 'stripe'
import type { CheckoutSessionRequest } from '@/lib/stripe/types'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    product: {
      update: vi.fn(),
    },
    webhookEvent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/email/automation', () => ({
  sendOrderConfirmationEmail: vi.fn(() => Promise.resolve({ success: true })),
}))

const mockCheckoutSessionsCreate = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate,
      },
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

describe('E2E: Checkout Session Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckoutSessionsCreate.mockClear()
    mockHeadersGet.mockClear()

    // Set required env variables
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
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

  it('should complete full checkout session flow from creation to payment success', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    // ========================================
    // STEP 1: Create order data
    // ========================================
    const orderId = 'clxxx1234567890abc' // Valid CUID for testing
    const mockOrder = {
      id: orderId,
      orderNumber: 'JMS-20260228-1234',
      total: 49.99,
      paymentStatus: 'PENDING',
      status: 'PENDING',
      confirmationEmailSentAt: null,
      guestEmail: 'customer@example.com',
      user: null,
      items: [
        {
          id: 'item-1',
          productId: 'prod-salsa-mild',
          productName: 'Mild Salsa',
          quantity: 2,
          unitPrice: 12.99,
        },
        {
          id: 'item-2',
          productId: 'prod-salsa-hot',
          productName: 'Hot Salsa',
          quantity: 1,
          unitPrice: 14.99,
        },
      ],
      giftCertificates: [],
      shippingMethod: '123 Main St, Portland, OR 97201',
      trackingNumber: null,
      createdAt: new Date('2024-01-15T10:00:00Z'),
    }

    const mockStripeSession = {
      id: 'cs_test_e2e_123',
      url: 'https://checkout.stripe.com/pay/cs_test_e2e_123',
    }

    const mockPendingPayment = {
      id: 'payment-pending-123',
      orderId: orderId,
      stripeCheckoutSessionId: 'cs_test_e2e_123',
      stripePaymentIntentId: '',
      amount: 4999,
      currency: 'usd',
      status: 'PENDING',
      metadata: {
        orderNumber: 'JMS-20260228-1234',
        itemCount: 2,
      },
      createdAt: new Date(),
    }

    // ========================================
    // STEP 2: Call /api/checkout/create-session
    // ========================================
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockCheckoutSessionsCreate.mockResolvedValue(mockStripeSession)
    vi.mocked(prisma.payment.create).mockResolvedValue(mockPendingPayment as any)

    const sessionRequest: CheckoutSessionRequest = {
      orderId,
    }

    const createSessionRequestObj = createRequest(sessionRequest)
    const createSessionResponse = await createSessionPOST(createSessionRequestObj)
    const sessionData = await createSessionResponse.json()

    // ========================================
    // STEP 3: Verify Stripe session created
    // ========================================
    expect(createSessionResponse.status).toBe(200)
    expect(sessionData.sessionId).toBe('cs_test_e2e_123')
    expect(sessionData.url).toBe('https://checkout.stripe.com/pay/cs_test_e2e_123')

    expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer_email: 'customer@example.com',
        metadata: expect.objectContaining({
          orderId: orderId,
          orderNumber: 'JMS-20260228-1234',
        }),
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 4999, // 49.99 * 100
            }),
          }),
        ],
      })
    )

    // Verify Payment record created with PENDING status
    expect(prisma.payment.create).toHaveBeenCalledWith({
      data: {
        orderId: orderId,
        stripeCheckoutSessionId: 'cs_test_e2e_123',
        stripePaymentIntentId: '',
        amount: 4999,
        currency: 'usd',
        status: 'PENDING',
        metadata: {
          orderNumber: 'JMS-20260228-1234',
          itemCount: 2,
        },
      },
    })

    // ========================================
    // STEP 4: Simulate successful payment webhook
    // ========================================
    vi.clearAllMocks()

    // Reset order mock to include items for webhook processing
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    // Mock webhook event check (no duplicate)
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({
      id: 'webhook-evt-123',
      stripeEventId: 'evt_e2e_test',
      type: 'payment_intent.succeeded',
      processed: false,
      createdAt: new Date(),
    } as any)
    vi.mocked(prisma.webhookEvent.update).mockResolvedValue({
      id: 'webhook-evt-123',
      stripeEventId: 'evt_e2e_test',
      type: 'payment_intent.succeeded',
      processed: true,
      createdAt: new Date(),
    } as any)

    // Mock transaction that updates order and payment
    const mockTransaction = vi.fn(async (callback) => {
      return callback({
        order: {
          update: vi.fn().mockResolvedValue({
            ...mockOrder,
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            stripePaymentId: 'pi_test_e2e_123',
          }),
        },
        payment: {
          upsert: vi.fn().mockResolvedValue({
            id: 'payment-success-123',
            orderId: orderId,
            stripePaymentIntentId: 'pi_test_e2e_123',
            amount: 4999,
            currency: 'usd',
            status: 'SUCCEEDED',
            paymentMethod: 'card',
          }),
        },
        product: {
          update: vi.fn(),
        },
      })
    })

    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)
    vi.mocked(sendOrderConfirmationEmail).mockResolvedValue({
      success: true,
      messageId: 'email_test_123',
    } as any)

    // Create payment_intent.succeeded webhook event
    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_e2e_test',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_e2e_123',
          object: 'payment_intent',
          amount: 4999,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            orderId: orderId,
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

    const webhookRequest = createRequest(paymentSucceededEvent)
    const webhookResponse = await webhookPOST(webhookRequest)
    const webhookData = await webhookResponse.json()

    // ========================================
    // STEP 5: Verify webhook processing
    // ========================================
    expect(webhookResponse.status).toBe(200)
    expect(webhookData.received).toBe(true)

    // Verify WebhookEvent idempotency check
    expect(prisma.webhookEvent.findUnique).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_e2e_test' },
    })

    // Verify WebhookEvent created
    expect(prisma.webhookEvent.upsert).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_e2e_test' },
      create: {
        stripeEventId: 'evt_e2e_test',
        type: 'payment_intent.succeeded',
        processed: false,
      },
      update: {
        type: 'payment_intent.succeeded',
      },
    })

    // Verify order was fetched
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: orderId },
      include: {
        items: true,
        giftCertificates: true,
      },
    })

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled()

    // ========================================
    // STEP 6: Verify Payment record SUCCEEDED
    // ========================================
    // Get the transaction callback to verify what was called inside
    const transactionCallback = mockTransaction.mock.calls[0][0]
    const mockTx = {
      order: { update: vi.fn() },
      payment: { upsert: vi.fn() },
      product: { update: vi.fn() },
    }
    await transactionCallback(mockTx)

    // Verify Payment upserted with SUCCEEDED status
    expect(mockTx.payment.upsert).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_test_e2e_123' },
      create: {
        stripePaymentIntentId: 'pi_test_e2e_123',
        orderId: orderId,
        amount: 4999,
        currency: 'usd',
        status: 'SUCCEEDED',
        paymentMethod: 'card',
      },
      update: {
        status: 'SUCCEEDED',
        paymentMethod: 'card',
      },
    })

    // ========================================
    // STEP 7: Verify Order status PAID
    // ========================================
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        stripePaymentId: 'pi_test_e2e_123',
      },
    })

    // Verify inventory was decremented
    expect(mockTx.product.update).toHaveBeenCalledTimes(2)
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-salsa-mild' },
      data: {
        inventory: { decrement: 2 },
      },
    })
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-salsa-hot' },
      data: {
        inventory: { decrement: 1 },
      },
    })

    // Verify confirmation email was triggered
    expect(sendOrderConfirmationEmail).toHaveBeenCalledWith(orderId)

    // Verify webhook event marked as processed
    expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_e2e_test' },
      data: { processed: true },
    })
  })

  it('should handle payment failure webhook correctly', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    // ========================================
    // STEP 1: Setup
    // ========================================
    const orderId = 'order-failed-123'

    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({
      id: 'webhook-evt-failed',
      stripeEventId: 'evt_failed',
      type: 'payment_intent.payment_failed',
      processed: false,
      createdAt: new Date(),
    } as any)
    vi.mocked(prisma.webhookEvent.update).mockResolvedValue({
      id: 'webhook-evt-failed',
      stripeEventId: 'evt_failed',
      type: 'payment_intent.payment_failed',
      processed: true,
      createdAt: new Date(),
    } as any)

    // Mock transaction for payment failure
    const mockTransaction = vi.fn(async (callback) => {
      return callback({
        order: {
          update: vi.fn().mockResolvedValue({
            id: orderId,
            paymentStatus: 'FAILED',
          }),
        },
        payment: {
          upsert: vi.fn().mockResolvedValue({
            id: 'payment-failed-123',
            orderId,
            status: 'FAILED',
          }),
        },
      })
    })

    vi.mocked(prisma.$transaction).mockImplementation(mockTransaction as any)

    // ========================================
    // STEP 2: Simulate payment failure webhook
    // ========================================
    const paymentFailedEvent: Stripe.Event = {
      id: 'evt_failed',
      object: 'event',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_failed',
          object: 'payment_intent',
          amount: 4999,
          currency: 'usd',
          payment_method_types: ['card'],
          metadata: {
            orderId,
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

    const webhookRequest = createRequest(paymentFailedEvent)
    const webhookResponse = await webhookPOST(webhookRequest)
    const webhookData = await webhookResponse.json()

    // ========================================
    // STEP 3: Verify payment failure handling
    // ========================================
    expect(webhookResponse.status).toBe(200)
    expect(webhookData.received).toBe(true)

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled()

    // Get the transaction callback to verify what was called inside
    const transactionCallback = mockTransaction.mock.calls[0][0]
    const mockTx = {
      order: { update: vi.fn() },
      payment: { upsert: vi.fn() },
    }
    await transactionCallback(mockTx)

    // Verify Order status updated to FAILED
    expect(mockTx.order.update).toHaveBeenCalledWith({
      where: { id: orderId },
      data: {
        paymentStatus: 'FAILED',
      },
    })

    // Verify Payment upserted with FAILED status
    expect(mockTx.payment.upsert).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_test_failed' },
      create: {
        stripePaymentIntentId: 'pi_test_failed',
        orderId,
        amount: 4999,
        currency: 'usd',
        status: 'FAILED',
        paymentMethod: 'card',
      },
      update: {
        status: 'FAILED',
      },
    })
  })

  it('should prevent duplicate webhook processing with WebhookEvent idempotency', async () => {
    const { default: prisma } = await import('@/lib/prisma')

    // ========================================
    // STEP 1: Mock duplicate webhook event
    // ========================================
    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue({
      id: 'webhook-duplicate',
      stripeEventId: 'evt_duplicate',
      type: 'payment_intent.succeeded',
      processed: true, // Already processed
      createdAt: new Date(),
    } as any)

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_duplicate',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_duplicate',
          object: 'payment_intent',
          metadata: {
            orderId: 'order-duplicate-123',
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

    const webhookRequest = createRequest(paymentSucceededEvent)
    const webhookResponse = await webhookPOST(webhookRequest)
    const webhookData = await webhookResponse.json()

    // ========================================
    // STEP 2: Verify duplicate was skipped
    // ========================================
    expect(webhookResponse.status).toBe(200)
    expect(webhookData.received).toBe(true)

    // Verify order was NOT fetched (skipped early)
    expect(prisma.order.findUnique).not.toHaveBeenCalled()

    // Verify transaction was NOT called (skipped processing)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('should skip processing if order already paid (double-webhook scenario)', async () => {
    const { default: prisma } = await import('@/lib/prisma')
    const { sendOrderConfirmationEmail } = await import('@/lib/email/automation')

    // ========================================
    // STEP 1: Mock already-paid order
    // ========================================
    const mockOrder = {
      id: 'order-already-paid',
      orderNumber: 'JMS-20260228-9999',
      paymentStatus: 'PAID', // Already paid
      status: 'CONFIRMED',
      confirmationEmailSentAt: new Date(),
      items: [],
      giftCertificates: [],
    }

    vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.webhookEvent.upsert).mockResolvedValue({
      id: 'webhook-evt-double',
      stripeEventId: 'evt_double',
      type: 'payment_intent.succeeded',
      processed: false,
      createdAt: new Date(),
    } as any)
    vi.mocked(prisma.webhookEvent.update).mockResolvedValue({
      id: 'webhook-evt-double',
      stripeEventId: 'evt_double',
      type: 'payment_intent.succeeded',
      processed: true,
      createdAt: new Date(),
    } as any)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const paymentSucceededEvent: Stripe.Event = {
      id: 'evt_double',
      object: 'event',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_double',
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

    const webhookRequest = createRequest(paymentSucceededEvent)
    const webhookResponse = await webhookPOST(webhookRequest)

    // ========================================
    // STEP 2: Verify processing was skipped
    // ========================================
    expect(webhookResponse.status).toBe(200)

    // Verify transaction was NOT called (order already paid)
    expect(prisma.$transaction).not.toHaveBeenCalled()

    // Verify email was NOT sent (already sent)
    expect(sendOrderConfirmationEmail).not.toHaveBeenCalled()
  })
})
