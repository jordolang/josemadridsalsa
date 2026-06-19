import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/orders/[id]/ship/route'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  default: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    shippingLabel: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/shipping-api', () => ({
  createShipment: vi.fn(),
  buyShipmentLabel: vi.fn(),
}))

vi.mock('@/lib/rbac', () => ({
  hasPermission: vi.fn(),
}))

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}))

// Get mock references after mocking
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { createShipment, buyShipmentLabel } from '@/lib/shipping-api'
import { hasPermission } from '@/lib/rbac'

const mockPrisma = prisma as any
const mockGetSession = getServerSession as any
const mockCreateShipment = createShipment as any
const mockBuyShipmentLabel = buyShipmentLabel as any
const mockHasPermission = hasPermission as any

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
    mockHasPermission.mockResolvedValue(true)

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

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder)

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

    mockPrisma.order.update.mockResolvedValue({
      ...mockOrder,
      status: 'SHIPPED',
      easypostShipmentId: 'shp_test123',
      carrierName: 'USPS',
      trackingUrl: 'https://track.easypost.com/TRACK123456',
      shippedAt: new Date(),
    })

    mockPrisma.shippingLabel.create.mockResolvedValue({
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
          fromAddress: {
            name: 'Jose Madrid Salsa Company',
            street1: '123 Business St',
            city: 'Portland',
            state: 'OR',
            zip: '97201',
            country: 'US',
          },
        }),
      }
    )

    const response = await POST(request, { params: Promise.resolve({ id: 'order-1' } })
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
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'SHIPPED',
        easypostShipmentId: 'shp_test123',
        carrierName: 'USPS',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
        shippedAt: expect.any(Date),
      }),
    })

    expect(mockPrisma.shippingLabel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        easypostShipmentId: 'shp_test123',
        trackingCode: 'TRACK123456',
        carrierName: 'USPS',
        serviceName: 'Priority',
      }),
    })

    // Verify audit log
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
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
    mockHasPermission.mockResolvedValue(false)

    const request = new NextRequest(
      'http://localhost:3000/api/orders/order-1/ship',
      {
        method: 'POST',
        body: JSON.stringify({
          rateId: 'rate_test1',
          parcel: { weight: 1, length: 5, width: 5, height: 5 },
          fromAddress: {
            street1: '123 St',
            city: 'Portland',
            state: 'OR',
            zip: '97201',
            country: 'US',
          },
        }),
      }
    )

    const response = await POST(request, { params: Promise.resolve({ id: 'order-1' }) })

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('Forbidden')
  })

  it('validates request body with Zod schema', async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: 'admin-1',
        role: 'ADMIN',
      },
    })
    mockHasPermission.mockResolvedValue(true)

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

    const response = await POST(request, { params: Promise.resolve({ id: 'order-1' } })

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
    mockHasPermission.mockResolvedValue(true)

    mockPrisma.order.findUnique.mockResolvedValue(null)

    const request = new NextRequest(
      'http://localhost:3000/api/orders/invalid-order/ship',
      {
        method: 'POST',
        body: JSON.stringify({
          rateId: 'rate_test1',
          parcel: { weight: 1, length: 5, width: 5, height: 5 },
          fromAddress: {
            street1: '123 St',
            city: 'Portland',
            state: 'OR',
            zip: '97201',
            country: 'US',
          },
        }),
      }
    )

    const response = await POST(request, { params: Promise.resolve({ id: 'invalid-order' } })

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
    mockHasPermission.mockResolvedValue(true)

    mockPrisma.order.findUnique.mockResolvedValue({
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
          fromAddress: {
            street1: '123 St',
            city: 'Portland',
            state: 'OR',
            zip: '97201',
            country: 'US',
          },
        }),
      }
    )

    const response = await POST(request, { params: Promise.resolve({ id: 'order-1' } })

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('shipping')
  })
})
