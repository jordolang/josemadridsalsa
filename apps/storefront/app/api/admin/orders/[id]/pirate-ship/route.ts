import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import {
  buildPirateShipCsv,
  type ComputedParcel,
} from '@/lib/shipping/pirate-ship'
import { shipmentInclude, toShipment } from '@/lib/shipping/pirate-ship-order'
import { verifyShippingAddress } from '@/lib/shipping-api'

/**
 * Pirate Ship export for a single order.
 *
 * - `GET`                — JSON preview: recipient, computed parcel, and the
 *   result of cross-referencing the shipping address against the carrier network.
 * - `GET ?download=1`    — the Pirate Ship import CSV (one row). Parcel fields
 *   may be overridden via query params so the admin can tweak weight/dimensions
 *   before exporting: weightLb, weightOz, lengthIn, widthIn, heightIn.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission('orders:read')

    const { id } = await params
    const order = await prisma.order.findUnique({
      where: { id },
      include: shipmentInclude,
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const shipment = toShipment(order)
    if (!shipment) {
      return NextResponse.json(
        { error: 'Order has no shipping address' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const parcel = applyParcelOverrides(shipment.parcel, searchParams)

    if (searchParams.get('download') === '1') {
      const csv = buildPirateShipCsv([{ recipient: shipment.recipient, parcel }])
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="pirateship-${order.orderNumber}.csv"`,
        },
      })
    }

    const verification = await verifyShippingAddress({
      name: shipment.recipient.name,
      company: shipment.recipient.company ?? undefined,
      street1: shipment.recipient.address1,
      city: shipment.recipient.city,
      state: shipment.recipient.state,
      zip: shipment.recipient.zip,
      country: shipment.recipient.country ?? 'US',
      phone: shipment.recipient.phone ?? undefined,
      email: shipment.recipient.email ?? undefined,
    })

    return NextResponse.json({
      orderNumber: order.orderNumber,
      recipient: shipment.recipient,
      parcel,
      verification,
    })
  } catch (error) {
    if (error instanceof Error && /Unauthorized|Forbidden/.test(error.message)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.startsWith('Unauthorized') ? 401 : 403 }
      )
    }
    console.error('Pirate Ship single export error:', error)
    return NextResponse.json(
      { error: 'Failed to build Pirate Ship export' },
      { status: 500 }
    )
  }
}

/**
 * Apply admin-supplied numeric overrides on top of the computed parcel. A
 * non-numeric or non-positive override is ignored, keeping the computed value.
 */
function applyParcelOverrides(
  parcel: ComputedParcel,
  searchParams: URLSearchParams
): ComputedParcel {
  const num = (key: string): number | null => {
    const raw = searchParams.get(key)
    if (raw == null) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }

  const weightLb = num('weightLb') ?? parcel.weightLb
  const weightOz = num('weightOz') ?? parcel.weightOz
  const lengthIn = num('lengthIn') ?? parcel.lengthIn
  const widthIn = num('widthIn') ?? parcel.widthIn
  const heightIn = num('heightIn') ?? parcel.heightIn

  return {
    ...parcel,
    weightLb,
    weightOz,
    totalOunces: Math.round(weightLb * 16 + weightOz),
    lengthIn,
    widthIn,
    heightIn,
  }
}
