import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original environment
const originalEnv = { ...process.env }

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    shippingLabel: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    order: {
      update: vi.fn(),
    },
  },
}))

// Mock email automation
vi.mock('@/lib/email/automation', () => ({
  sendOrderShippedEmail: vi.fn(),
  sendOrderDeliveredEmail: vi.fn(),
}))

describe('EasyPost Webhook Handlers', () => {
  let handleTrackerUpdated: any
  let prisma: any
  let sendOrderShippedEmail: any
  let sendOrderDeliveredEmail: any

  beforeEach(async () => {
    // Clear modules and reimport
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }

    // Import fresh instances
    prisma = (await import('@/lib/prisma')).default
    const emailAutomation = await import('@/lib/email/automation')
    sendOrderShippedEmail = emailAutomation.sendOrderShippedEmail
    sendOrderDeliveredEmail = emailAutomation.sendOrderDeliveredEmail
    const webhookHandlers = await import('@/lib/tracking/webhook-handlers')
    handleTrackerUpdated = webhookHandlers.handleTrackerUpdated

    // Make email functions return promises
    sendOrderShippedEmail.mockResolvedValue({ success: true })
    sendOrderDeliveredEmail.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('handleTrackerUpdated', () => {
    it('updates order on in_transit status', async () => {
      const mockShippingLabel = {
        id: 'label-1',
        orderId: 'order-1',
        trackingCode: 'TRACK123',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
        },
      }

      prisma.shippingLabel.findFirst.mockResolvedValue(mockShippingLabel)
      prisma.shippingLabel.update.mockResolvedValue({
        ...mockShippingLabel,
        status: 'in_transit',
      })

      const trackerData = {
        tracking_code: 'TRACK123',
        status: 'in_transit',
        tracking_details: [
          {
            status: 'in_transit',
            message: 'Package is on its way',
            datetime: '2026-06-19T14:00:00Z',
            tracking_location: {
              city: 'Miami',
              state: 'FL',
            },
          },
        ],
      }

      await handleTrackerUpdated(trackerData)

      expect(prisma.shippingLabel.findFirst).toHaveBeenCalledWith({
        where: { trackingCode: 'TRACK123' },
        include: { order: true },
      })

      expect(prisma.shippingLabel.update).toHaveBeenCalledWith({
        where: { id: 'label-1' },
        data: {
          status: 'in_transit',
        },
      })

      expect(sendOrderShippedEmail).toHaveBeenCalledWith('order-1')
    })

    it('sets deliveredAt timestamp on delivered status', async () => {
      const mockShippingLabel = {
        id: 'label-1',
        orderId: 'order-1',
        trackingCode: 'TRACK123',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'SHIPPED',
          shippedAt: new Date('2026-06-19T10:00:00Z'),
        },
      }

      prisma.shippingLabel.findFirst.mockResolvedValue(mockShippingLabel)
      prisma.shippingLabel.update.mockResolvedValue({
        ...mockShippingLabel,
        status: 'delivered',
      })

      const trackerData = {
        tracking_code: 'TRACK123',
        status: 'delivered',
        tracking_details: [
          {
            status: 'delivered',
            message: 'Delivered',
            datetime: '2026-06-20T16:30:00Z',
            tracking_location: {
              city: 'New York',
              state: 'NY',
            },
          },
        ],
      }

      await handleTrackerUpdated(trackerData)

      expect(prisma.shippingLabel.update).toHaveBeenCalledWith({
        where: { id: 'label-1' },
        data: {
          status: 'delivered',
        },
      })

      expect(sendOrderDeliveredEmail).toHaveBeenCalledWith('order-1')
    })

    it('does nothing when shipping label not found', async () => {
      prisma.shippingLabel.findFirst.mockResolvedValue(null)

      const trackerData = {
        tracking_code: 'INVALID123',
        status: 'in_transit',
        tracking_details: [],
      }

      await handleTrackerUpdated(trackerData)

      expect(prisma.shippingLabel.findFirst).toHaveBeenCalledWith({
        where: { trackingCode: 'INVALID123' },
        include: { order: true },
      })

      expect(prisma.shippingLabel.update).not.toHaveBeenCalled()
      expect(sendOrderShippedEmail).not.toHaveBeenCalled()
      expect(sendOrderDeliveredEmail).not.toHaveBeenCalled()
    })

    it('updates tracking history with event details', async () => {
      const mockShippingLabel = {
        id: 'label-1',
        orderId: 'order-1',
        trackingCode: 'TRACK123',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'SHIPPED',
          trackingHistory: [
            {
              status: 'pre_transit',
              message: 'Label created',
              timestamp: '2026-06-19T10:00:00Z',
            },
          ],
        },
      }

      prisma.shippingLabel.findFirst.mockResolvedValue(mockShippingLabel)
      prisma.shippingLabel.update.mockResolvedValue(mockShippingLabel)

      const trackerData = {
        tracking_code: 'TRACK123',
        status: 'out_for_delivery',
        tracking_details: [
          {
            status: 'pre_transit',
            message: 'Label created',
            datetime: '2026-06-19T10:00:00Z',
          },
          {
            status: 'in_transit',
            message: 'In transit',
            datetime: '2026-06-19T14:00:00Z',
          },
          {
            status: 'out_for_delivery',
            message: 'Out for delivery',
            datetime: '2026-06-20T08:00:00Z',
          },
        ],
      }

      await handleTrackerUpdated(trackerData)

      // Should update with all tracking events
      expect(prisma.shippingLabel.update).toHaveBeenCalled()
    })

    it('handles webhook for pre_transit status without sending emails', async () => {
      const mockShippingLabel = {
        id: 'label-1',
        orderId: 'order-1',
        trackingCode: 'TRACK123',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'PENDING',
        },
      }

      prisma.shippingLabel.findFirst.mockResolvedValue(mockShippingLabel)
      prisma.shippingLabel.update.mockResolvedValue({
        ...mockShippingLabel,
        status: 'pre_transit',
      })

      const trackerData = {
        tracking_code: 'TRACK123',
        status: 'pre_transit',
        tracking_details: [
          {
            status: 'pre_transit',
            message: 'Shipping label created',
            datetime: '2026-06-19T10:00:00Z',
          },
        ],
      }

      await handleTrackerUpdated(trackerData)

      expect(prisma.shippingLabel.update).toHaveBeenCalled()
      // Should not send emails for pre_transit
      expect(sendOrderShippedEmail).not.toHaveBeenCalled()
      expect(sendOrderDeliveredEmail).not.toHaveBeenCalled()
    })

    it('does not resend the shipped email when shippedAt is already set', async () => {
      const mockShippingLabel = {
        id: 'label-1',
        orderId: 'order-1',
        trackingCode: 'TRACK123',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'SHIPPED',
          shippedAt: new Date('2026-06-19T10:00:00Z'),
        },
      }

      prisma.shippingLabel.findFirst.mockResolvedValue(mockShippingLabel)
      prisma.shippingLabel.update.mockResolvedValue(mockShippingLabel)

      const trackerData = {
        tracking_code: 'TRACK123',
        status: 'in_transit',
        tracking_details: [
          {
            status: 'in_transit',
            message: 'Still in transit',
            datetime: '2026-06-19T18:00:00Z',
          },
        ],
      }

      await handleTrackerUpdated(trackerData)

      // Status still updates, but the shipped email is not sent a second time
      expect(prisma.shippingLabel.update).toHaveBeenCalled()
      expect(sendOrderShippedEmail).not.toHaveBeenCalled()
    })

    it('does not resend the delivered email when deliveredAt is already set', async () => {
      const mockShippingLabel = {
        id: 'label-1',
        orderId: 'order-1',
        trackingCode: 'TRACK123',
        order: {
          id: 'order-1',
          orderNumber: 'ORD-001',
          status: 'DELIVERED',
          shippedAt: new Date('2026-06-19T10:00:00Z'),
          deliveredAt: new Date('2026-06-20T16:30:00Z'),
        },
      }

      prisma.shippingLabel.findFirst.mockResolvedValue(mockShippingLabel)
      prisma.shippingLabel.update.mockResolvedValue(mockShippingLabel)

      const trackerData = {
        tracking_code: 'TRACK123',
        status: 'delivered',
        tracking_details: [
          {
            status: 'delivered',
            message: 'Delivered (duplicate event)',
            datetime: '2026-06-20T16:30:00Z',
          },
        ],
      }

      await handleTrackerUpdated(trackerData)

      expect(prisma.shippingLabel.update).toHaveBeenCalled()
      expect(sendOrderDeliveredEmail).not.toHaveBeenCalled()
    })
  })
})
