import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/admin/orders/[id]/refund/route'

// Mock dependencies
vi.mock('@/lib/rbac', () => ({
  requirePermission: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit', () => ({
  logAuditWithRequest: vi.fn(),
}))

const mockStripeRefundsCreate = vi.fn()
const mockStripePaymentIntentsRetrieve = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => ({
    refunds: {
      create: mockStripeRefundsCreate,
    },
    paymentIntents: {
      retrieve: mockStripePaymentIntentsRetrieve,
    },
  })),
}))

describe('POST /api/admin/orders/[id]/refund', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStripeRefundsCreate.mockClear()
    mockStripePaymentIntentsRetrieve.mockClear()
  })

  const mockUser = {
    id: 'user-admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
  }

  const mockOrder = {
    id: 'order-123',
    orderNumber: 'JMS-20260211-1234',
    total: 100,
    paymentStatus: 'PAID',
    stripePaymentId: 'pi_test123',
    items: [],
  }

  const mockPaymentIntent = {
    id: 'pi_test123',
    charges: {
      data: [
        {
          id: 'ch_test123',
          amount: 10000, // $100 in cents
          amount_refunded: 0,
          refunds: {
            data: [],
          },
        },
      ],
    },
  }

  const mockRefund = {
    id: 're_test123',
    amount: 10000,
    status: 'succeeded',
    created: 1707657600,
  }

  // ========================================
  // 1. Refund Amount Validation Tests
  // ========================================

  it('should refund valid amount successfully', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')
    const { logAuditWithRequest } = await import('@/lib/audit')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.refund.amount).toBe(50)
    expect(mockStripeRefundsCreate).toHaveBeenCalledWith({
      charge: 'ch_test123',
      amount: 5000, // $50 in cents
      metadata: {
        orderId: 'order-123',
        orderNumber: 'JMS-20260211-1234',
        refundedBy: 'user-admin-123',
      },
    })
    expect(logAuditWithRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-admin-123',
        action: 'orders.refund',
        entityType: 'order',
        entityId: 'order-123',
      }),
      request
    )
  })

  it('should reject refund amount exceeding order total', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 150 }), // Order total is $100
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('cannot exceed order total')
  })

  it('should reject refund amount exceeding refundable amount after partial refund', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const partiallyRefundedOrder = {
      ...mockOrder,
      paymentStatus: 'PARTIALLY_REFUNDED',
    }

    const paymentIntentWithRefund = {
      ...mockPaymentIntent,
      charges: {
        data: [
          {
            id: 'ch_test123',
            amount: 10000, // $100 in cents
            amount_refunded: 3000, // $30 already refunded
            refunds: {
              data: [{ amount: 3000 }],
            },
          },
        ],
      },
    }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(partiallyRefundedOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(paymentIntentWithRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 71 }), // Only $70 refundable
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('exceeds refundable amount')
  })

  it('should reject negative refund amount', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: -10 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('must be a positive number')
  })

  it('should reject zero refund amount', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 0 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('must be a positive number')
  })

  it('should reject missing refund amount', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('amount is required')
  })

  // ========================================
  // 2. Refund Authorization Tests
  // ========================================

  it('should reject non-admin user without orders:write permission', async () => {
    const { requirePermission } = await import('@/lib/rbac')

    vi.mocked(requirePermission).mockRejectedValue(new Error('Permission denied'))

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Permission denied')
    expect(requirePermission).toHaveBeenCalledWith('orders:write')
  })

  it('should allow admin user with orders:write permission', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(response.status).toBe(200)
    expect(requirePermission).toHaveBeenCalledWith('orders:write')
  })

  // ========================================
  // 3. Order Status Validation Tests
  // ========================================

  it('should refund order with status PAID', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(response.status).toBe(200)
  })

  it('should refund order with status PARTIALLY_REFUNDED', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const partiallyRefundedOrder = {
      ...mockOrder,
      paymentStatus: 'PARTIALLY_REFUNDED',
    }

    const paymentIntentWithRefund = {
      ...mockPaymentIntent,
      charges: {
        data: [
          {
            id: 'ch_test123',
            amount: 10000,
            amount_refunded: 3000,
            refunds: { data: [{ amount: 3000 }] },
          },
        ],
      },
    }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(partiallyRefundedOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(paymentIntentWithRefund)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 40 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(response.status).toBe(200)
  })

  it('should reject refund for order with status PENDING', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const pendingOrder = { ...mockOrder, paymentStatus: 'PENDING' }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(pendingOrder as any)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Cannot refund order with payment status: PENDING')
  })

  it('should reject refund for order with status FAILED', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const failedOrder = { ...mockOrder, paymentStatus: 'FAILED' }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(failedOrder as any)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Cannot refund order with payment status: FAILED')
  })

  it('should reject refund for fully refunded order', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const refundedOrder = { ...mockOrder, paymentStatus: 'REFUNDED' }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(refundedOrder as any)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Cannot refund order with payment status: REFUNDED')
  })

  it('should return 404 for non-existent order', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/admin/orders/invalid-id/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'invalid-id' }) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Order not found')
  })

  // ========================================
  // 4. Partial Refund Calculation Tests
  // ========================================

  it('should process first partial refund ($30 of $100)', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue({ ...mockRefund, amount: 3000 })

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 30 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.refund.amount).toBe(30)
    expect(data.order.refundableAmount).toBe(70)
  })

  it('should process second partial refund ($40 of $100, total $70)', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const partiallyRefundedOrder = {
      ...mockOrder,
      paymentStatus: 'PARTIALLY_REFUNDED',
    }

    const paymentIntentWith30Refunded = {
      ...mockPaymentIntent,
      charges: {
        data: [
          {
            id: 'ch_test123',
            amount: 10000,
            amount_refunded: 3000,
            refunds: { data: [{ amount: 3000 }] },
          },
        ],
      },
    }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(partiallyRefundedOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(paymentIntentWith30Refunded)
    mockStripeRefundsCreate.mockResolvedValue({ ...mockRefund, amount: 4000 })

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 40 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.refund.amount).toBe(40)
    expect(data.order.totalRefunded).toBe(70)
    expect(data.order.refundableAmount).toBe(30)
  })

  it('should process final partial refund ($30 of $100, total $100)', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const partiallyRefundedOrder = {
      ...mockOrder,
      paymentStatus: 'PARTIALLY_REFUNDED',
    }

    const paymentIntentWith70Refunded = {
      ...mockPaymentIntent,
      charges: {
        data: [
          {
            id: 'ch_test123',
            amount: 10000,
            amount_refunded: 7000,
            refunds: { data: [{ amount: 3000 }, { amount: 4000 }] },
          },
        ],
      },
    }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(partiallyRefundedOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(paymentIntentWith70Refunded)
    mockStripeRefundsCreate.mockResolvedValue({ ...mockRefund, amount: 3000 })

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 30 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.refund.amount).toBe(30)
    expect(data.order.totalRefunded).toBe(100)
    expect(data.order.refundableAmount).toBe(0)
  })

  it('should reject refund when amount exceeds remaining ($31 when only $30 left)', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    const partiallyRefundedOrder = {
      ...mockOrder,
      paymentStatus: 'PARTIALLY_REFUNDED',
    }

    const paymentIntentWith70Refunded = {
      ...mockPaymentIntent,
      charges: {
        data: [
          {
            id: 'ch_test123',
            amount: 10000,
            amount_refunded: 7000,
            refunds: { data: [{ amount: 3000 }, { amount: 4000 }] },
          },
        ],
      },
    }

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(partiallyRefundedOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(paymentIntentWith70Refunded)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 31 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'order-123' }) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('exceeds refundable amount')
  })

  // ========================================
  // 5. Stripe Integration Tests
  // ========================================

  it('should create refund in Stripe with correct charge ID', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(mockStripePaymentIntentsRetrieve).toHaveBeenCalledWith('pi_test123')
    expect(mockStripeRefundsCreate).toHaveBeenCalledWith({
      charge: 'ch_test123',
      amount: 5000,
      metadata: expect.objectContaining({
        orderId: 'order-123',
        orderNumber: 'JMS-20260211-1234',
        refundedBy: 'user-admin-123',
      }),
    })
  })

  it('should convert refund amount to cents correctly', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 25.50 }),
    })

    await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(mockStripeRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2550, // $25.50 in cents
      })
    )
  })

  it('should include metadata with orderId, orderNumber, and refundedBy', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(mockStripeRefundsCreate).toHaveBeenCalledWith({
      charge: 'ch_test123',
      amount: 5000,
      metadata: {
        orderId: 'order-123',
        orderNumber: 'JMS-20260211-1234',
        refundedBy: 'user-admin-123',
      },
    })
  })

  // ========================================
  // 6. Audit Logging Tests
  // ========================================

  it('should log refund action to AuditLog table', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')
    const { logAuditWithRequest } = await import('@/lib/audit')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(logAuditWithRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-admin-123',
        action: 'orders.refund',
        entityType: 'order',
        entityId: 'order-123',
      }),
      request
    )
  })

  it('should log with userId, action, entityType, entityId, and changes', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')
    const { logAuditWithRequest } = await import('@/lib/audit')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    })

    await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(logAuditWithRequest).toHaveBeenCalledWith(
      {
        userId: 'user-admin-123',
        action: 'orders.refund',
        entityType: 'order',
        entityId: 'order-123',
        changes: expect.objectContaining({
          refundAmount: 50,
          refundId: 're_test123',
          orderNumber: 'JMS-20260211-1234',
        }),
      },
      request
    )
  })

  it('should include refundAmount, refundId, and orderNumber in changes', async () => {
    const { requirePermission } = await import('@/lib/rbac')
    const { default: prisma } = await import('@/lib/prisma')
    const { logAuditWithRequest } = await import('@/lib/audit')

    vi.mocked(requirePermission).mockResolvedValue(mockUser)
    vi.mocked(prisma.order.findUnique).mockResolvedValue(mockOrder as any)
    mockStripePaymentIntentsRetrieve.mockResolvedValue(mockPaymentIntent)
    mockStripeRefundsCreate.mockResolvedValue(mockRefund)

    const request = new NextRequest('http://localhost/api/admin/orders/order-123/refund', {
      method: 'POST',
      body: JSON.stringify({ amount: 75 }),
    })

    await POST(request, { params: Promise.resolve({ id: 'order-123' }) })

    expect(logAuditWithRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: {
          refundAmount: 75,
          refundId: 're_test123',
          orderNumber: 'JMS-20260211-1234',
          totalPaid: 100,
          totalRefunded: 75,
        },
      }),
      request
    )
  })
})
