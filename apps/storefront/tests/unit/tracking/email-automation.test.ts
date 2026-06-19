import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from '@/lib/email/automation'

// Mock dependencies
const mockFindUnique = vi.fn()
const mockSend = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: mockFindUnique,
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mockSend,
}))

describe('Email Automation - Shipping Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('sendOrderShippedEmail', () => {
    it('sends shipped email with tracking information', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        guestEmail: 'customer@example.com',
        user: null,
        trackingNumber: 'TRACK123456',
        carrierName: 'USPS',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
        shippedAt: new Date('2026-06-19T14:00:00Z'),
        items: [
          {
            productName: 'Mild Salsa',
            quantity: 2,
            unitPrice: 8.99,
            product: {
              name: 'Mild Salsa',
              image: 'https://example.com/salsa.jpg',
            },
          },
        ],
      }

      mockFindUnique.mockResolvedValue(mockOrder)
      mockSend.mockResolvedValue({ success: true })

      await sendOrderShippedEmail('order-1')

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: {
          user: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      })

      expect(mockSend).toHaveBeenCalledWith({
        to: 'customer@example.com',
        subject: expect.stringContaining('ORD-001'),
        template: 'order-shipped',
        data: expect.objectContaining({
          orderNumber: 'ORD-001',
          trackingNumber: 'TRACK123456',
          carrierName: 'USPS',
          trackingUrl: 'https://track.easypost.com/TRACK123456',
        }),
      })
    })

    it('sends to user email when order is not guest order', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        guestEmail: null,
        user: {
          email: 'user@example.com',
        },
        trackingNumber: 'TRACK123456',
        carrierName: 'UPS',
        trackingUrl: 'https://www.ups.com/track/TRACK123456',
        items: [],
      }

      mockFindUnique.mockResolvedValue(mockOrder)
      mockSend.mockResolvedValue({ success: true })

      await sendOrderShippedEmail('order-1')

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
        })
      )
    })

    it('throws error when order not found', async () => {
      mockFindUnique.mockResolvedValue(null)

      await expect(sendOrderShippedEmail('invalid-order')).rejects.toThrow(
        'Order not found'
      )

      expect(mockSend).not.toHaveBeenCalled()
    })

    it('throws error when order has no tracking information', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        guestEmail: 'customer@example.com',
        trackingNumber: null,
        carrierName: null,
        trackingUrl: null,
        items: [],
      }

      mockFindUnique.mockResolvedValue(mockOrder)

      await expect(sendOrderShippedEmail('order-1')).rejects.toThrow(
        'Order has no tracking information'
      )

      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('sendOrderDeliveredEmail', () => {
    it('sends delivered email with delivery confirmation', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        guestEmail: 'customer@example.com',
        user: null,
        trackingNumber: 'TRACK123456',
        deliveredAt: new Date('2026-06-20T16:30:00Z'),
        items: [
          {
            productName: 'Hot Salsa',
            quantity: 1,
            unitPrice: 9.99,
            product: {
              name: 'Hot Salsa',
              image: 'https://example.com/hot-salsa.jpg',
            },
          },
        ],
      }

      mockFindUnique.mockResolvedValue(mockOrder)
      mockSend.mockResolvedValue({ success: true })

      await sendOrderDeliveredEmail('order-1')

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: {
          user: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      })

      expect(mockSend).toHaveBeenCalledWith({
        to: 'customer@example.com',
        subject: expect.stringContaining('ORD-001'),
        subject: expect.stringContaining('Delivered'),
        template: 'order-delivered',
        data: expect.objectContaining({
          orderNumber: 'ORD-001',
          deliveredAt: expect.any(Date),
        }),
      })
    })

    it('includes feedback request link in delivered email', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        guestEmail: 'customer@example.com',
        deliveredAt: new Date('2026-06-20T16:30:00Z'),
        items: [],
      }

      mockFindUnique.mockResolvedValue(mockOrder)
      mockSend.mockResolvedValue({ success: true })

      await sendOrderDeliveredEmail('order-1')

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            feedbackUrl: expect.stringContaining('/feedback'),
          }),
        })
      )
    })

    it('throws error when order not found', async () => {
      mockFindUnique.mockResolvedValue(null)

      await expect(sendOrderDeliveredEmail('invalid-order')).rejects.toThrow(
        'Order not found'
      )

      expect(mockSend).not.toHaveBeenCalled()
    })

    it('handles email send failure gracefully', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        guestEmail: 'customer@example.com',
        deliveredAt: new Date('2026-06-20T16:30:00Z'),
        items: [],
      }

      mockFindUnique.mockResolvedValue(mockOrder)
      mockSend.mockRejectedValue(new Error('Email service unavailable'))

      await expect(sendOrderDeliveredEmail('order-1')).rejects.toThrow(
        'Email service unavailable'
      )
    })
  })
})
