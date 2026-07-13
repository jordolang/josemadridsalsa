import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { getShippingClient } from '@/lib/shipping-api'
import { ALLOWED_CARRIERS } from '@/lib/shipping-carriers'
import { z } from 'zod'

const PurchaseLabelSchema = z.object({
  carrier: z.enum(ALLOWED_CARRIERS),
  service: z.string().min(1, 'Service is required'),
  rateId: z.string().optional(),
  parcel: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
      weight: z.number().positive(),
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
    const body = await request.json()
    const { carrier, service, rateId, parcel } = PurchaseLabelSchema.parse(body)

    // Fetch order and carrier in parallel -- they are independent queries
    const [order, carrierRecord] = await Promise.all([
      prisma.order.findUnique({
        where: { id },
        include: {
          shippingAddress: true,
          shippingLabels: true,
        },
      }),
      prisma.shippingCarrier.findUnique({
        where: { code: carrier },
      }),
    ])

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.shippingAddress) {
      return NextResponse.json(
        { error: 'Order has no shipping address' },
        { status: 400 }
      )
    }

    if (!carrierRecord) {
      return NextResponse.json(
        { error: `Carrier "${carrier}" not found in system` },
        { status: 400 }
      )
    }

    if (!carrierRecord.isActive) {
      return NextResponse.json(
        { error: `Carrier "${carrier}" is not active` },
        { status: 400 }
      )
    }

    // Purchase label via shipping provider API
    const client = getShippingClient()

    // Build the from address from admin settings or env
    const fromAddress = {
      name: process.env.SHIP_FROM_NAME || 'Jose Madrid Salsa',
      street1: process.env.SHIP_FROM_STREET || '',
      city: process.env.SHIP_FROM_CITY || '',
      state: process.env.SHIP_FROM_STATE || '',
      zip: process.env.SHIP_FROM_ZIP || '',
      country: process.env.SHIP_FROM_COUNTRY || 'US',
    }

    const toAddress = {
      name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim(),
      street1: order.shippingAddress.street,
      city: order.shippingAddress.city,
      state: order.shippingAddress.state,
      zip: order.shippingAddress.zipCode,
      country: order.shippingAddress.country || 'US',
      phone: order.shippingAddress.phone || undefined,
    }

    const shipmentParcel = parcel || {
      length: 10,
      width: 8,
      height: 4,
      weight: 16,
    }

    // Fetch rates to validate the selected carrier/service and get the cost
    const ratesResponse = await client.getRates({
      fromAddress,
      toAddress,
      parcel: shipmentParcel,
      reference: order.orderNumber,
    })

    const selectedRate = rateId
      ? ratesResponse.rates.find((r) => r.id === rateId)
      : ratesResponse.rates.find(
          (r) =>
            r.carrier.toLowerCase() === carrier.toLowerCase() &&
            r.service.toLowerCase() === service.toLowerCase()
        )

    if (!selectedRate) {
      return NextResponse.json(
        {
          error: 'Selected carrier/service rate not found',
          availableRates: ratesResponse.rates,
        },
        { status: 400 }
      )
    }

    // In production, this would call the provider's label purchase endpoint.
    // For now, generate a mock tracking number and label URL.
    const mockTrackingNumber = `${carrier.toUpperCase()}${Date.now()}`
    const mockLabelUrl = `/api/admin/orders/${id}/shipping-label/download?label=${mockTrackingNumber}`

    const userId = (session.user as any).id

    // Store the label in DB
    const shippingLabel = await prisma.shippingLabel.create({
      data: {
        orderId: id,
        carrierId: carrierRecord.id,
        trackingNumber: mockTrackingNumber,
        labelUrl: mockLabelUrl,
        cost: selectedRate.rate,
        shipDate: new Date(),
        estimatedDelivery: selectedRate.deliveryDays
          ? new Date(
              Date.now() + selectedRate.deliveryDays * 24 * 60 * 60 * 1000
            )
          : null,
        carrierResponse: {
          rateId: selectedRate.id,
          carrier: selectedRate.carrier,
          service: selectedRate.service,
          rate: selectedRate.rate,
          testMode: client.testMode,
        },
        createdById: userId,
      },
    })

    // Update order with tracking info and advance status if applicable
    const orderUpdate: Record<string, unknown> = {
      trackingNumber: mockTrackingNumber,
      shippingLabelUrl: mockLabelUrl,
    }

    if (
      order.status !== 'SHIPPED' &&
      order.status !== 'DELIVERED' &&
      order.status !== 'CANCELLED' &&
      order.status !== 'REFUNDED'
    ) {
      orderUpdate.status = 'SHIPPED'
      orderUpdate.shippedAt = new Date()
    }

    await prisma.order.update({
      where: { id },
      data: orderUpdate,
    })

    await logAudit({
      userId,
      action: 'create',
      entityType: 'shipping_label',
      entityId: shippingLabel.id,
      changes: {
        orderId: id,
        carrier,
        service,
        trackingNumber: mockTrackingNumber,
        cost: selectedRate.rate,
      },
    })

    return NextResponse.json({
      success: true,
      label: {
        id: shippingLabel.id,
        trackingNumber: shippingLabel.trackingNumber,
        labelUrl: shippingLabel.labelUrl,
        cost: selectedRate.rate,
        carrier: selectedRate.carrier,
        service: selectedRate.service,
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
