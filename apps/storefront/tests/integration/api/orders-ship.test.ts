import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/orders/[id]/ship/route'
import { NextRequest } from 'next/server'

// Mock dependencies
const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockCreate = vi.fn()
const mockCreateAuditLog = vi.fn()
const mockGetSession = vi.fn()
const mockCreateShipment = vi.fn()
const mockBuyShipmentLabel = vi.fn()

vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    shippingLabel: {
      create: mockCreate,
    },
    auditLog: {
      create: mockCreateAuditLog,
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  getServerSession: mockGetSession,
}))

vi.mock('@/lib/shipping-api', () => ({
  createShipment: mockCreateShipment,
  buyShipmentLabel: mockBuyShipmentLabel,
}))

describe('POST /api/orders/[id]/ship - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SHIPPING_API_KEY = 'test_api_key'
  })

  it('creates shipment and purchases label for valid order', async () => {
    // Mock admin session
    mockGetSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      },
    })

    // Mock order with shipping address
    const mockOrder = {
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'PAID',
      shippingAddress: {
        name: 'John Doe',
        street: '456 Customer Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        phone: '212-555-5678',
      },
      items: [
        {
          productName: 'Mild Salsa',
          quantity: 2,
          unitPrice: 8.99,
        },
      ],
    }

    mockFindUnique.mockResolvedValue(mockOrder)

    // Mock shipment creation
    mockCreateShipment.mockResolvedValue({
      shipmentId: 'shp_test123',
      rates: [
        {
          id: 'rate_test1',
          carrier: 'USPS',
          service: 'Priority',
          price: '10.50',
        },
      ],
    })

    // Mock label purchase
    mockBuyShipmentLabel.mockResolvedValue({
      shipmentId: 'shp_test123',
      trackingCode: 'TRACK123456',
      labelUrl: 'https://easypost.com/labels/test.pdf',
      trackingUrl: 'https://track.easypost.com/TRACK123456',
      carrier: 'USPS',
      service: 'Priority',
    })

    mockUpdate.mockResolvedValue({
      ...mockOrder,
      status: 'SHIPPED',
      easypostShipmentId: 'shp_test123',
      carrierName: 'USPS',
      trackingUrl: 'https://track.easypost.com/TRACK123456',
      shippedAt: new Date(),
    })

    mockCreate.mockResolvedValue({
      id: 'label-1',
      orderId: 'order-1',
      easypostShipmentId: 'shp_test123',
      trackingCode: 'TRACK123456',
      labelUrl: 'https://easypost.com/labels/test.pdf',
      carrierName: 'USPS',
      serviceName: 'Priority',
      status: 'pre_transit',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Create request
    const request = new NextRequest(
      'http://localhost:3000/api/orders/order-1/ship',
      {
        method: 'POST',
        body: JSON.stringify({
          rateId: 'rate_test1',
          parcel: {
            weight: 2.5,
            length: 10,
            width: 8,
            height: 6,
          },
        }),
      }
    )

    const response = await POST(request, { params: { id: 'order-1' } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      trackingCode: 'TRACK123456',
      labelUrl: 'https://easypost.com/labels/test.pdf',
      trackingUrl: 'https://track.easypost.com/TRACK123456',
      carrier: 'USPS',
    })

    // Verify database updates
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'SHIPPED',
        easypostShipmentId: 'shp_test123',
        carrierName: 'USPS',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
        shippedAt: expect.any(Date),
      }),
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        easypostShipmentId: 'shp_test123',
        trackingCode: 'TRACK123456',
        carrierName: 'USPS',
        serviceName: 'Priority',
      }),
    })

    // Verify audit log
    expect(mockCreateAuditLog).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'ORDER_SHIPPED',
        entityType: 'ORDER',
        entityId: 'order-1',
        userId: 'admin-1',
      }),
    })
  })

  it('requires admin permissions', async () => {
    // Mock non-admin session
    mockGetSession.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'CUSTOMER',
      },
    })

    const request = new NextRequest(
      'http://localhost:3000/api/orders/order-1/ship',
      {
        method: 'POST',
        body: JSON.stringify({
          rateId: 'rate_test1',
          parcel: { weight: 1, length: 5, width: 5, height: 5 },
        }),
      }
    )

    const response = await POST(request, { params: { id: 'order-1' } })

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('validates request body with Zod schema', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        role: 'ADMIN',
      },
    })

    // Invalid request - missing required fields
    const request = new NextRequest(
      'http://localhost:3000/api/orders/order-1/ship',
      {
        method: 'POST',
        body: JSON.stringify({
          rateId: 'rate_test1',
          // Missing parcel field
        }),
      }
    )

    const response = await POST(request, { params: { id: 'order-1' } })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid request data')
    expect(data.details).toBeDefined()
  })

  it('returns 404 when order not found', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        role: 'ADMIN',
      },
    })

    mockFindUnique.mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost:3000/api/orders/invalid-order/ship',
      {
        method: 'POST',
        body: JSON.stringify({
          rateId: 'rate_test1',
          parcel: { weight: 1, length: 5, width: 5, height: 5 },
        }),
      }
    )

    const response = await POST(request, { params: { id: 'invalid-order' } })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Order not found')
  })

  it('handles EasyPost API errors gracefully', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        role: 'ADMIN',
      },
    })

    mockFindUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      shippingAddress: {},
      items: [],
    })

    mockCreateShipment.mockRejectedValue(
      new Error('Invalid shipping address')
    )

    const request = new NextRequest(
      'http://localhost:3000/api/orders/order-1/ship',
      {
        method: 'POST',
        body: JSON.stringify({
          rateId: 'rate_test1',
          parcel: { weight: 1, length: 5, width: 5, height: 5 },
        }),
      }
    )

    const response = await POST(request, { params: { id: 'order-1' } })

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('shipping')
  })
})
