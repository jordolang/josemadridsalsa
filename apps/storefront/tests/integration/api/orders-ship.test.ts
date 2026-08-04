import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/orders/[orderId]/ship/route'
import { NextRequest } from 'next/server'

// Mock dependencies. The route imports prisma as a named export, so expose
// the mock under both `default` and `prisma` pointing at the same object.
vi.mock('@/lib/prisma', () => {
  const mock = {
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
  }
  return { default: mock, prisma: mock }
})

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
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { createShipment, buyShipmentLabel } from '@/lib/shipping-api'
import { hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

const mockPrisma = prisma as any
const mockGetSession = getServerSession as any
const mockCreateShipment = createShipment as any
const mockBuyShipmentLabel = buyShipmentLabel as any
const mockHasPermission = hasPermission as any
const mockLogAudit = logAudit as any

// Shapes aligned with the CreatedShipment / ShippingLabel types returned by
// @/lib/shipping-api.
const mockCreatedShipment = {
  id: 'shp_test123',
  rates: [
    {
      id: 'rate_test1',
      carrier: 'USPS',
      service: 'Priority',
      rate: 10.5,
      currency: 'USD',
    },
  ],
}

const mockShippingLabel = {
  id: 'shp_test123',
  trackingCode: 'TRACK123456',
  trackingUrl: 'https://track.easypost.com/TRACK123456',
  labelUrl: 'https://easypost.com/labels/test.pdf',
  carrier: 'USPS',
  service: 'Priority',
  rate: 10.5,
  currency: 'USD',
  status: 'pre_transit',
  createdAt: new Date(),
}

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost:3000/api/orders/order-1/ship', {
    method: 'POST',
    body: JSON.stringify(body),
  })

const validBody = {
  rateId: 'rate_test1',
  parcel: { weight: 2.5, length: 10, width: 8, height: 6 },
  fromAddress: {
    name: 'Jose Madrid Salsa Company',
    street1: '123 Business St',
    city: 'Portland',
    state: 'OR',
    zip: '97201',
    country: 'US',
  },
}

describe('POST /api/orders/[orderId]/ship - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SHIPPING_API_KEY = 'test_api_key'
  })

  it('creates shipment and purchases label for valid order', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
    })
    mockHasPermission.mockResolvedValue(true)

    const mockOrder = {
      id: 'order-1',
      orderNumber: 'ORD-001',
      status: 'PAID',
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '456 Customer Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
        phone: '212-555-5678',
      },
      items: [{ productName: 'Mild Salsa', quantity: 2, unitPrice: 8.99 }],
    }

    mockPrisma.order.findUnique.mockResolvedValue(mockOrder)
    mockCreateShipment.mockResolvedValue(mockCreatedShipment)
    mockBuyShipmentLabel.mockResolvedValue(mockShippingLabel)
    mockPrisma.order.update.mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      trackingNumber: 'TRACK123456',
      trackingUrl: 'https://track.easypost.com/TRACK123456',
    })
    mockPrisma.shippingLabel.create.mockResolvedValue({ id: 'label-1' })

    const response = await POST(buildRequest(validBody), {
      params: Promise.resolve({ orderId: 'order-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    // Response is a nested { shipment, order } envelope
    expect(data.shipment).toEqual(
      expect.objectContaining({
        id: 'shp_test123',
        trackingCode: 'TRACK123456',
        labelUrl: 'https://easypost.com/labels/test.pdf',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
        carrier: 'USPS',
        service: 'Priority',
      })
    )
    expect(data.order).toEqual(
      expect.objectContaining({
        id: 'order-1',
        trackingNumber: 'TRACK123456',
      })
    )

    // buyShipmentLabel called with the shipment id and selected rate
    expect(mockBuyShipmentLabel).toHaveBeenCalledWith('shp_test123', 'rate_test1')

    // Order updated with tracking info
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        easypostShipmentId: 'shp_test123',
        trackingNumber: 'TRACK123456',
        carrierName: 'USPS',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
      }),
    })

    // ShippingLabel record created
    expect(mockPrisma.shippingLabel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-1',
        easypostShipmentId: 'shp_test123',
        trackingCode: 'TRACK123456',
        carrierName: 'USPS',
        serviceName: 'Priority',
        status: 'pre_transit',
      }),
    })

    // Audit logged via logAudit helper
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        entityType: 'shipment',
        entityId: 'order-1',
        userId: 'admin-1',
      })
    )
  })

  it('rejects with 409 when the order already has a shipping label', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' },
    })
    mockHasPermission.mockResolvedValue(true)
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PROCESSING',
      easypostShipmentId: 'shp_existing',
      trackingNumber: 'TRACK_EXISTING',
      shippingAddress: { firstName: 'John', lastName: 'Doe', street: '1 A St', city: 'NY', state: 'NY', zipCode: '10001', country: 'US' },
      items: [],
    })

    const response = await POST(buildRequest(validBody), {
      params: Promise.resolve({ orderId: 'order-1' }),
    })

    expect(response.status).toBe(409)
    const data = await response.json()
    expect(data.error).toBe('Order already has a shipping label')
    // No new shipment/label should be purchased
    expect(mockCreateShipment).not.toHaveBeenCalled()
    expect(mockBuyShipmentLabel).not.toHaveBeenCalled()
  })

  it('requires admin permissions', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com', role: 'CUSTOMER' },
    })
    mockHasPermission.mockResolvedValue(false)

    const response = await POST(
      buildRequest({
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
      { params: Promise.resolve({ orderId: 'order-1' }) }
    )

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('Forbidden')
  })

  it('validates request body with Zod schema', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockHasPermission.mockResolvedValue(true)

    // Invalid request - missing required parcel field
    const response = await POST(
      buildRequest({ rateId: 'rate_test1' }),
      { params: Promise.resolve({ orderId: 'order-1' }) }
    )

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid request data')
    expect(data.details).toBeDefined()
  })

  it('returns 404 when order not found', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockHasPermission.mockResolvedValue(true)
    mockPrisma.order.findUnique.mockResolvedValue(null)

    const response = await POST(
      buildRequest({
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
      { params: Promise.resolve({ orderId: 'invalid-order' }) }
    )

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('Order not found')
  })

  it('handles EasyPost API errors gracefully', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    mockHasPermission.mockResolvedValue(true)

    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PAID',
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        street: '456 Customer Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'US',
      },
      items: [],
    })

    mockCreateShipment.mockRejectedValue(new Error('Invalid shipping address'))

    const response = await POST(
      buildRequest({
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
      { params: Promise.resolve({ orderId: 'order-1' }) }
    )

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toContain('shipment')
  })
})
