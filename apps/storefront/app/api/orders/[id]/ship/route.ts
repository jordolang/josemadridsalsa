import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, type UserRole } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'
import {
  createShipment,
  buyShipmentLabel,
  type ShipmentRequest,
} from '@/lib/shipping-api'

const ShipmentRequestSchema = z.object({
  rateId: z.string().optional(),
  parcel: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    weight: z.number().positive(),
  }),
  fromAddress: z.object({
    name: z.string().optional(),
    company: z.string().optional(),
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
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

    const permitted = await hasPermission(session.user as unknown as { role: UserRole }, 'orders:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { rateId, parcel, fromAddress } = ShipmentRequestSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        shippingAddress: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.shippingAddress) {
      return NextResponse.json({ error: 'Order has no shipping address' }, { status: 400 })
    }

    // Create shipment request
    const shipmentRequest: ShipmentRequest = {
      fromAddress,
      toAddress: {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
        company: order.shippingAddress.company || undefined,
        street1: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.zipCode,
        country: order.shippingAddress.country,
        phone: order.shippingAddress.phone || undefined,
      },
      parcel,
      reference: order.orderNumber,
    }

    // Create shipment in EasyPost
    const shipment = await createShipment(shipmentRequest)

    if (shipment.rates.length === 0) {
      return NextResponse.json(
        { error: 'No shipping rates available for this destination' },
        { status: 400 }
      )
    }

    // Use provided rateId or select the cheapest rate
    const selectedRateId = rateId || shipment.rates[0].id
    const selectedRate = shipment.rates.find((r) => r.id === selectedRateId)

    if (!selectedRate) {
      return NextResponse.json({ error: 'Invalid rate selected' }, { status: 400 })
    }

    // Purchase shipping label
    const label = await buyShipmentLabel(shipment.id, selectedRateId)

    // Update order with tracking information
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        easypostShipmentId: label.id,
        trackingNumber: label.trackingCode,
        trackingUrl: label.trackingUrl,
        carrierName: label.carrier,
        shippingMethod: label.service,
        shippingLabelUrl: label.labelUrl,
        lastTrackingUpdate: new Date(),
        status: order.status === 'CONFIRMED' || order.status === 'PENDING' ? 'PROCESSING' : order.status,
      },
    })

    // Create ShippingLabel record
    await prisma.shippingLabel.create({
      data: {
        orderId: id,
        easypostShipmentId: label.id,
        trackingCode: label.trackingCode,
        labelUrl: label.labelUrl || '',
        carrierName: label.carrier,
        serviceName: label.service,
        status: label.status,
      },
    })

    await logAudit({
      userId: (session.user as { id: string }).id,
      action: 'create',
      entityType: 'shipment',
      entityId: id,
      changes: {
        easypostShipmentId: label.id,
        trackingCode: label.trackingCode,
        carrier: label.carrier,
        service: label.service,
        rate: label.rate,
      },
    })

    return NextResponse.json({
      success: true,
      shipment: {
        id: label.id,
        trackingCode: label.trackingCode,
        trackingUrl: label.trackingUrl,
        labelUrl: label.labelUrl,
        carrier: label.carrier,
        service: label.service,
        rate: label.rate,
        currency: label.currency,
      },
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        trackingNumber: updatedOrder.trackingNumber,
        trackingUrl: updatedOrder.trackingUrl,
      },
    })
  } catch (error) {
    console.error('Create shipment error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create shipment' },
      { status: 500 }
    )
  }
}
