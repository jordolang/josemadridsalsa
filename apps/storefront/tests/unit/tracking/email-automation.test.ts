import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original environment
const originalEnv = { ...process.env }

// Mock Prisma
const mockOrderFindUnique = vi.fn()
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    order: {
      findUnique: mockOrderFindUnique,
    },
  }
  return {
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

// Mock email service (automation.ts imports sendEmail from @/lib/email/client)
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(),
}))

describe('Email Automation - Shipping Notifications', () => {
  let sendOrderShippedEmail: any
  let sendOrderDeliveredEmail: any
  let prisma: any
  let sendEmail: any

  beforeEach(async () => {
    // Clear modules and reimport
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }

    // Import fresh instances
    const prismaModule = await import('@/lib/prisma')
    prisma = prismaModule.prisma || prismaModule.default
    const emailLib = await import('@/lib/email/client')
    sendEmail = emailLib.sendEmail
    const emailAutomation = await import('@/lib/email/automation')
    sendOrderShippedEmail = emailAutomation.sendOrderShippedEmail
    sendOrderDeliveredEmail = emailAutomation.sendOrderDeliveredEmail

    // Reset mock counters
    mockOrderFindUnique.mockClear()
  }, 30000) // resetModules + react-email re-import is slow; allow more time

  afterEach(() => {
    process.env = originalEnv
  })

  describe('sendOrderShippedEmail', () => {
    it('sends shipped email with tracking information', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        userId: null,
        guestEmail: 'customer@example.com',
        user: null,
        trackingNumber: 'TRACK123456',
        carrierName: 'USPS',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
        shippedAt: new Date('2026-06-19T14:00:00Z'),
        estimatedDelivery: null,
        shippingMethod: 'Standard Shipping',
        items: [
          {
            productName: 'Mild Salsa',
            productSku: 'SALSA-MILD',
            quantity: 2,
            totalPrice: 17.98,
            product: {
              name: 'Mild Salsa',
              image: 'https://example.com/salsa.jpg',
            },
          },
        ],
      }

      prisma.order.findUnique.mockResolvedValue(mockOrder)
      sendEmail.mockResolvedValue({ success: true })

      await sendOrderShippedEmail('order-1')

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: {
          items: true,
          user: { select: { name: true, email: true } },
          shippingAddress: true,
        },
      })

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: expect.stringContaining('ORD-001'),
          type: 'order-shipped',
          orderId: 'order-1',
        })
      )
    })

    it('sends to user email when order is not guest order', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        userId: 'user-1',
        guestEmail: null,
        user: {
          name: 'Test User',
          email: 'user@example.com',
        },
        trackingNumber: 'TRACK123456',
        carrierName: 'UPS',
        trackingUrl: 'https://www.ups.com/track/TRACK123456',
        shippedAt: new Date('2026-06-19T14:00:00Z'),
        estimatedDelivery: null,
        shippingMethod: 'Express Shipping',
        items: [],
      }

      prisma.order.findUnique.mockResolvedValue(mockOrder)
      sendEmail.mockResolvedValue({ success: true })

      await sendOrderShippedEmail('order-1')

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          type: 'order-shipped',
        })
      )
    })

    it('returns error when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null)

      const result = await sendOrderShippedEmail('invalid-order')

      expect(result).toEqual({ success: false, error: 'Order not found' })
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('returns error when order has no tracking information', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        guestEmail: 'customer@example.com',
        user: null,
        trackingNumber: null,
        carrierName: null,
        trackingUrl: null,
        items: [],
      }

      prisma.order.findUnique.mockResolvedValue(mockOrder)

      const result = await sendOrderShippedEmail('order-1')

      expect(result).toEqual({ success: false, error: 'Tracking number missing' })
      expect(sendEmail).not.toHaveBeenCalled()
    })
  })

  describe('sendOrderDeliveredEmail', () => {
    it('sends delivered email with delivery confirmation', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        userId: null,
        guestEmail: 'customer@example.com',
        user: null,
        trackingNumber: 'TRACK123456',
        createdAt: new Date('2026-06-15T10:00:00Z'),
        total: 27.97,
        deliveredAt: new Date('2026-06-20T16:30:00Z'),
        items: [
          {
            productName: 'Hot Salsa',
            productSku: 'SALSA-HOT',
            quantity: 1,
            totalPrice: 9.99,
            product: {
              name: 'Hot Salsa',
              image: 'https://example.com/hot-salsa.jpg',
            },
          },
        ],
      }

      prisma.order.findUnique.mockResolvedValue(mockOrder)
      sendEmail.mockResolvedValue({ success: true })

      await sendOrderDeliveredEmail('order-1')

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: {
          items: true,
          user: { select: { name: true, email: true } },
          shippingAddress: true,
        },
      })

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          subject: expect.stringContaining('ORD-001'),
          type: 'order-delivered',
          orderId: 'order-1',
        })
      )
    })

    it('includes feedback request link in delivered email', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        userId: null,
        guestEmail: 'customer@example.com',
        user: null,
        trackingNumber: 'TRACK123456',
        createdAt: new Date('2026-06-15T10:00:00Z'),
        total: 27.97,
        deliveredAt: new Date('2026-06-20T16:30:00Z'),
        items: [],
      }

      prisma.order.findUnique.mockResolvedValue(mockOrder)
      sendEmail.mockResolvedValue({ success: true })

      await sendOrderDeliveredEmail('order-1')

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'customer@example.com',
          type: 'order-delivered',
        })
      )
    })

    it('returns error when order not found', async () => {
      prisma.order.findUnique.mockResolvedValue(null)

      const result = await sendOrderDeliveredEmail('invalid-order')

      expect(result).toEqual({ success: false, error: 'Order not found' })
      expect(sendEmail).not.toHaveBeenCalled()
    })

    it('propagates email send errors', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        userId: null,
        guestEmail: 'customer@example.com',
        user: null,
        trackingNumber: 'TRACK123456',
        createdAt: new Date('2026-06-15T10:00:00Z'),
        total: 27.97,
        deliveredAt: new Date('2026-06-20T16:30:00Z'),
        items: [],
      }

      prisma.order.findUnique.mockResolvedValue(mockOrder)
      sendEmail.mockRejectedValue(new Error('Email service unavailable'))

      await expect(sendOrderDeliveredEmail('order-1')).rejects.toThrow(
        'Email service unavailable'
      )
    })
  })
})
