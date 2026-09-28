import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { buildFulfillmentUpdate, fulfillEntireOrder, recordFulfillmentEvent } from '@/lib/orders/fulfillment'
import { getShippingClient } from '@/lib/shipping-api'
import { ALLOWED_CARRIERS } from '@/lib/shipping-carriers'
import { describeMissingOrigin, getShippingOrigin } from '@/lib/shipping/origin'
import { filterRates, isRealPostage, selectRate } from '@/lib/shipping/rate-selection'
import { buildShippingItems, calculateOrderParcel } from '@/lib/shipping-calculator'
import { z } from 'zod'
import { bigCommerceOrderLock } from '@/lib/bigcommerce/order-lock'

/**
 * Everything is optional.
 *
 * The requirement is that a staff member clicks one button: the parcel is derived from the order's
 * own items using the same packing model that quoted the customer, the origin comes from the shared
 * resolver, and the cheapest rate wins. Pinning a carrier, a service, a specific rate or a hand
 * measured parcel is available for the cases that need it.
 */
const PurchaseLabelSchema = z.object({
  carrier: z.enum(ALLOWED_CARRIERS).optional(),
  service: z.string().min(1).optional(),
  rateId: z.string().min(1).optional(),
  parcel: z
    .object({
      length: z.number().positive().max(108),
      width: z.number().positive().max(108),
      height: z.number().positive().max(108),
      /** Ounces. */
      weight: z.number().positive().max(1120),
    })
    .optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'orders:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const locked = await bigCommerceOrderLock(id)
    if (locked) return locked
    const { carrier, service, rateId, parcel } = PurchaseLabelSchema.parse(
      await request.json().catch(() => ({}))
    )

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        shippingAddress: true,
        shippingLabels: true,
        items: { select: { productId: true, quantity: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.shippingAddress) {
      return NextResponse.json(
        { error: 'Order has no shipping address' },
        { status: 400 }
      )
    }

    // Buying twice charges twice, and an order already shipped through Pirate Ship must not also
    // get an EasyPost label. Legacy mock rows deliberately do not count — no parcel ever shipped
    // for those, so they must not block a real purchase.
    const existingLabel = order.shippingLabels.find(isRealPostage)
    if (existingLabel) {
      return NextResponse.json(
        {
          error: `This order already has postage (${existingLabel.trackingNumber}). Buying another label would charge again.`,
        },
        { status: 409 }
      )
    }

    const client = getShippingClient()

    // Shared with rate quoting, so the address a customer was quoted from and the address the
    // parcel leaves from cannot be configured independently. Refuses rather than shipping from a
    // half-filled address, which the carrier would accept and then fail to deliver.
    const origin = await getShippingOrigin()
    if (!origin.ok) {
      return NextResponse.json({ error: describeMissingOrigin(origin.missing) }, { status: 400 })
    }
    const fromAddress = origin.origin

    const toAddress = {
      name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim(),
      street1: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      zip: order.shippingAddress.zipCode,
      country: order.shippingAddress.country || 'US',
      phone: order.shippingAddress.phone || undefined,
    }

    // The parcel the order actually needs, from the same packing model that quoted the customer at
    // checkout — three jars to a line, four lines to a case, and gross weight including the glass.
    // A hand-measured override is accepted for the odd parcel that does not fit the grid.
    const products = await prisma.product.findMany({
      where: { id: { in: order.items.map((item) => item.productId) } },
      select: {
        id: true,
        weight: true,
        lengthInches: true,
        widthInches: true,
        heightInches: true,
      },
    })

    const derived = calculateOrderParcel(
      buildShippingItems(order.items, new Map(products.map((p) => [p.id, p])))
    )
    const shipmentParcel = parcel ?? derived

    // A shipment, then a purchase. The old code called `getRates` and stopped there, synthesising
    // `${CARRIER}${Date.now()}` as a tracking number and pointing `labelUrl` at a download route
    // that does not exist — so it marked orders shipped, showed customers a tracking number that
    // 404s, and bought no postage. `buyShipmentLabel` needs a shipment id, and only a bought
    // shipment yields a real label.
    const shipment = await client.createShipment({
      fromAddress,
      toAddress,
      parcel: shipmentParcel,
      reference: order.orderNumber,
    })

    const candidates = filterRates(shipment.rates, carrier, service)
    if (candidates.length === 0 && (carrier || service)) {
      return NextResponse.json(
        {
          error: `No rate available for ${[carrier, service].filter(Boolean).join(' ')}.`,
          availableRates: shipment.rates,
        },
        { status: 400 }
      )
    }

    const selected = selectRate(candidates, rateId)
    if (!selected.ok) {
      return NextResponse.json(
        { error: selected.message, availableRates: shipment.rates },
        { status: 400 }
      )
    }

    const label = await client.buyShipmentLabel(shipment.id, selected.rate.id)

    const userId = (session.user as any).id

    // Best effort: the carrier the rate came back on may not have a `ShippingCarrier` row, and the
    // column is nullable. Not having one is not a reason to refuse a label that is already bought.
    const carrierRecord = await prisma.shippingCarrier.findFirst({
      where: { code: { equals: label.carrier, mode: 'insensitive' } },
      select: { id: true },
    })

    const shippingLabel = await prisma.shippingLabel.create({
      data: {
        orderId: id,
        carrierId: carrierRecord?.id ?? null,
        // Both columns, deliberately. `trackingNumber` is what the admin screens and the customer
        // emails read; `trackingCode` is what the EasyPost tracking webhook matches on to advance
        // the order to delivered. The mock only ever filled the first, so tracking never worked.
        trackingNumber: label.trackingCode,
        trackingCode: label.trackingCode,
        easypostShipmentId: label.id,
        carrierName: label.carrier,
        serviceName: label.service,
        status: label.status,
        // The carrier's own hosted label. No local download route to maintain.
        labelUrl: label.labelUrl,
        // What we actually paid, which is not what the customer paid — see `Order.shippingCost`.
        cost: label.rate,
        shipDate: new Date(),
        estimatedDelivery: selected.rate.deliveryDays
          ? new Date(Date.now() + selected.rate.deliveryDays * 24 * 60 * 60 * 1000)
          : null,
        carrierResponse: {
          shipmentId: label.id,
          rateId: selected.rate.id,
          carrier: label.carrier,
          service: label.service,
          rate: label.rate,
          currency: label.currency,
          trackingUrl: label.trackingUrl ?? null,
          // Spread into a plain object: `Parcel` is an interface without an index signature, which
          // Prisma's JSON input type rejects.
          parcel: {
            length: shipmentParcel.length,
            width: shipmentParcel.width,
            height: shipmentParcel.height,
            weight: shipmentParcel.weight,
          },
          parcelSource: parcel ? 'override' : 'derived',
          testMode: client.testMode,
        },
        createdById: userId,
      },
    })

    // Update order with tracking info and advance status if applicable
    const orderUpdate: Record<string, unknown> = {
      trackingNumber: label.trackingCode,
      shippingLabelUrl: label.labelUrl,
    }

    const advancesFulfillment =
      order.status !== 'SHIPPED' &&
      order.status !== 'DELIVERED' &&
      order.status !== 'CANCELLED' &&
      order.status !== 'REFUNDED'

    if (advancesFulfillment) {
      Object.assign(orderUpdate, buildFulfillmentUpdate({ transition: 'shipped', current: order }))
    }

    await prisma.order.update({
      where: { id },
      data: orderUpdate,
    })

    await emitDomainEvent({
      type: 'shipment.created',
      entityType: 'order',
      entityId: id,
      actorUserId: userId,
      payload: {
        carrier: label.carrier,
        service: label.service,
        trackingNumber: label.trackingCode,
        costCents: Math.round(label.rate * 100),
        labelId: shippingLabel.id,
      },
    })

    if (advancesFulfillment) {
      await fulfillEntireOrder(prisma, id, { via: 'admin:shipping-label', createdById: userId })

      await recordFulfillmentEvent({
        orderId: id,
        transition: 'shipped',
        current: order,
        actorUserId: userId,
        eventPayload: { orderNumber: order.orderNumber, via: 'admin:shipping-label' },
      })
    }

    await logAudit({
      userId,
      action: 'create',
      entityType: 'shipping_label',
      entityId: shippingLabel.id,
      changes: {
        orderId: id,
        carrier: label.carrier,
        service: label.service,
        trackingNumber: label.trackingCode,
        cost: label.rate,
        parcel: shipmentParcel,
      },
    })

    return NextResponse.json({
      success: true,
      label: {
        id: shippingLabel.id,
        trackingNumber: shippingLabel.trackingNumber,
        labelUrl: shippingLabel.labelUrl,
        cost: label.rate,
        carrier: label.carrier,
        service: label.service,
        trackingUrl: label.trackingUrl ?? null,
        estimatedDelivery: shippingLabel.estimatedDelivery,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Purchase shipping label error:', error)
    return NextResponse.json(
      { error: 'Failed to purchase shipping label' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'orders:read')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const labels = await prisma.shippingLabel.findMany({
      where: { orderId: id },
      include: { carrier: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      labels: labels.map((label) => ({
        id: label.id,
        trackingNumber: label.trackingNumber,
        labelUrl: label.labelUrl,
        cost: label.cost,
        carrier: label.carrier?.name ?? label.carrierName ?? null,
        carrierCode: label.carrier?.code ?? null,
        shipDate: label.shipDate,
        estimatedDelivery: label.estimatedDelivery,
        createdAt: label.createdAt,
      })),
    })
  } catch (error) {
    console.error('Get shipping labels error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shipping labels' },
      { status: 500 }
    )
  }
}
