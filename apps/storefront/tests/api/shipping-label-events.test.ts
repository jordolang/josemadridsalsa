import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Buying postage has to announce the shipment.
 *
 * This is the one automation the audit records as deliberately manual — an operator presses the
 * button, because postage costs money. Everything *after* the purchase is automatic, and hangs off
 * `shipment.created`. The tests below pin that the fact is recorded once a label really exists,
 * carries the tracking number that the customer email and the tracking webhook both key on, and
 * is not recorded on any path that bought nothing.
 */

const getServerSession = vi.fn()
const hasPermission = vi.fn()
const orderFindUnique = vi.fn()
const orderUpdate = vi.fn()
const productFindMany = vi.fn()
const carrierFindFirst = vi.fn()
const labelCreate = vi.fn()
const emitDomainEvent = vi.fn()
const createShipment = vi.fn()
const buyShipmentLabel = vi.fn()
const getShippingOrigin = vi.fn()
const fulfillEntireOrder = vi.fn()
const recordFulfillmentEvent = vi.fn()
const logAudit = vi.fn()

vi.mock('next-auth', () => ({ getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/rbac', () => ({ hasPermission }))
vi.mock('@/lib/audit', () => ({ logAudit }))
vi.mock('@/lib/domain-events/emit', () => ({ emitDomainEvent }))

vi.mock('@/lib/prisma', () => {
  const client = {
    order: { findUnique: orderFindUnique, update: orderUpdate },
    product: { findMany: productFindMany },
    shippingCarrier: { findFirst: carrierFindFirst },
    shippingLabel: { create: labelCreate },
  }
  return { prisma: client, default: client }
})

vi.mock('@/lib/shipping-api', () => ({
  getShippingClient: () => ({ createShipment, buyShipmentLabel }),
}))

vi.mock('@/lib/shipping/origin', () => ({
  getShippingOrigin,
  describeMissingOrigin: () => 'Warehouse address is not configured',
}))

vi.mock('@/lib/orders/fulfillment', () => ({
  buildFulfillmentUpdate: () => ({ fulfillmentStatus: 'FULFILLED' }),
  fulfillEntireOrder,
  recordFulfillmentEvent,
}))

const { POST } = await import('@/app/api/admin/orders/[id]/shipping-label/route')

const ORDER_ID = 'order_ship_1'

function purchaseRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(
    `http://localhost:3000/api/admin/orders/${ORDER_ID}/shipping-label`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

const params = Promise.resolve({ id: ORDER_ID })

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    orderNumber: 'JMS-8001',
    status: 'PROCESSING',
    shippingAddress: {
      firstName: 'Sam',
      lastName: 'Rivera',
      street: '42 Elm St',
      city: 'Columbus',
      state: 'OH',
      zipCode: '43215',
      country: 'US',
      phone: null,
    },
    shippingLabels: [],
    items: [{ productId: 'prod_1', quantity: 2 }],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getServerSession.mockResolvedValue({ user: { id: 'admin_1' } })
  hasPermission.mockResolvedValue(true)
  orderFindUnique.mockResolvedValue(order())
  orderUpdate.mockResolvedValue({})
  productFindMany.mockResolvedValue([
    { id: 'prod_1', weight: 16, lengthInches: 3, widthInches: 3, heightInches: 5 },
  ])
  carrierFindFirst.mockResolvedValue({ id: 'carrier_1' })
  labelCreate.mockResolvedValue({ id: 'label_1' })
  createShipment.mockResolvedValue({
    id: 'shp_1',
    rates: [
      { id: 'rate_1', carrier: 'USPS', service: 'GroundAdvantage', rate: 8.42, deliveryDays: 3 },
    ],
  })
  buyShipmentLabel.mockResolvedValue({
    id: 'shp_1',
    carrier: 'USPS',
    service: 'GroundAdvantage',
    trackingCode: '9400111899223',
    labelUrl: 'https://easypost.example/label.pdf',
    status: 'purchased',
    rate: 8.42,
    currency: 'USD',
  })
  getShippingOrigin.mockResolvedValue({
    ok: true,
    origin: {
      name: 'Jose Madrid Salsa',
      street1: '123 Warehouse Way',
      city: 'Zanesville',
      state: 'OH',
      zip: '43701',
      country: 'US',
    },
  })
  fulfillEntireOrder.mockResolvedValue(undefined)
  recordFulfillmentEvent.mockResolvedValue(undefined)
  logAudit.mockResolvedValue(undefined)
})

describe('POST /api/admin/orders/[id]/shipping-label', () => {
  it('records shipment.created once the label is bought', async () => {
    await POST(purchaseRequest(), { params })

    expect(emitDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'shipment.created',
        entityType: 'order',
        entityId: ORDER_ID,
        actorUserId: 'admin_1',
      })
    )
  })

  it('carries the real tracking number, not a synthesised one', async () => {
    await POST(purchaseRequest(), { params })

    // The tracking webhook matches on this to advance the order to delivered, so a placeholder
    // here breaks the shipped and delivered emails downstream of it.
    expect(emitDomainEvent.mock.calls[0][0].payload).toMatchObject({
      carrier: 'USPS',
      service: 'GroundAdvantage',
      trackingNumber: '9400111899223',
      labelId: 'label_1',
    })
  })

  it('records what the postage actually cost, in cents', async () => {
    await POST(purchaseRequest(), { params })

    expect(emitDomainEvent.mock.calls[0][0].payload.costCents).toBe(842)
  })

  it('announces nothing when the caller may not write orders', async () => {
    hasPermission.mockResolvedValue(false)

    const response = await POST(purchaseRequest(), { params })

    expect(response.status).toBe(403)
    expect(buyShipmentLabel).not.toHaveBeenCalled()
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('announces nothing to an unauthenticated caller', async () => {
    getServerSession.mockResolvedValue(null)

    const response = await POST(purchaseRequest(), { params })

    expect(response.status).toBe(401)
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('refuses to buy a second label, and announces nothing', async () => {
    orderFindUnique.mockResolvedValue(
      order({
        shippingLabels: [
          {
            id: 'label_existing',
            trackingNumber: '9400111899000',
            // `trackingCode` is what marks a label as real postage rather than a legacy mock row.
            trackingCode: '9400111899000',
            labelUrl: 'https://easypost.example/existing.pdf',
            easypostShipmentId: 'shp_existing',
          },
        ],
      })
    )

    const response = await POST(purchaseRequest(), { params })

    // Buying twice charges twice. The event must not fire either, or the customer is emailed a
    // second shipment that does not exist.
    expect(response.status).toBe(409)
    expect(buyShipmentLabel).not.toHaveBeenCalled()
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('announces nothing when the warehouse address is not configured', async () => {
    getShippingOrigin.mockResolvedValue({ ok: false, missing: ['street1'] })

    const response = await POST(purchaseRequest(), { params })

    expect(response.status).toBe(400)
    expect(createShipment).not.toHaveBeenCalled()
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('announces nothing when the order has no address to ship to', async () => {
    orderFindUnique.mockResolvedValue(order({ shippingAddress: null }))

    const response = await POST(purchaseRequest(), { params })

    expect(response.status).toBe(400)
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })

  it('announces nothing when no rate matches the requested service', async () => {
    const response = await POST(
      purchaseRequest({ carrier: 'UPS', service: 'NextDayAir' }),
      { params }
    )

    expect(response.status).toBe(400)
    expect(buyShipmentLabel).not.toHaveBeenCalled()
    expect(emitDomainEvent).not.toHaveBeenCalled()
  })
})
