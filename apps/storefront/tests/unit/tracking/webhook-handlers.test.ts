import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleTrackerUpdated } from '@/lib/tracking/webhook-handlers'

// Mock dependencies
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockSendOrderShippedEmail = vi.fn()
const mockSendOrderDeliveredEmail = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    shippingLabel: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    order: {
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email/automation', () => ({
  sendOrderShippedEmail: mockSendOrderShippedEmail,
  sendOrderDeliveredEmail: mockSendOrderDeliveredEmail,
}))

describe('EasyPost Webhook Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

      mockFindUnique.mockResolvedValue(mockShippingLabel)
      mockUpdate.mockResolvedValue({
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

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { trackingCode: 'TRACK123' },
        include: { order: true },
      })

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'label-1' },
        data: {
          status: 'in_transit',
        },
      })

      expect(mockSendOrderShippedEmail).toHaveBeenCalledWith('order-1')
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

      mockFindUnique.mockResolvedValue(mockShippingLabel)
      mockUpdate.mockResolvedValue({
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

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'label-1' },
        data: {
          status: 'delivered',
        },
      })

      expect(mockSendOrderDeliveredEmail).toHaveBeenCalledWith('order-1')
    })

    it('does nothing when shipping label not found', async () => {
      mockFindUnique.mockResolvedValue(null)

      const trackerData = {
        tracking_code: 'INVALID123',
        status: 'in_transit',
        tracking_details: [],
      }

      await handleTrackerUpdated(trackerData)

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { trackingCode: 'INVALID123' },
        include: { order: true },
      })

      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockSendOrderShippedEmail).not.toHaveBeenCalled()
      expect(mockSendOrderDeliveredEmail).not.toHaveBeenCalled()
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

      mockFindUnique.mockResolvedValue(mockShippingLabel)
      mockUpdate.mockResolvedValue(mockShippingLabel)

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
      expect(mockUpdate).toHaveBeenCalled()
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

      mockFindUnique.mockResolvedValue(mockShippingLabel)
      mockUpdate.mockResolvedValue({
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

      expect(mockUpdate).toHaveBeenCalled()
      // Should not send emails for pre_transit
      expect(mockSendOrderShippedEmail).not.toHaveBeenCalled()
      expect(mockSendOrderDeliveredEmail).not.toHaveBeenCalled()
    })
  })
})
