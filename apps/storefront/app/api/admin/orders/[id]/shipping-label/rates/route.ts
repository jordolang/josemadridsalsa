import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { getShippingClient } from '@/lib/shipping-api'
import { describeMissingOrigin, getShippingOrigin } from '@/lib/shipping/origin'
import { buildShippingItems, calculateOrderParcel } from '@/lib/shipping-calculator'
import { packJars, describeJarPacking } from '@/lib/shipping/jar-packing'

/**
 * GET /api/admin/orders/[id]/shipping-label/rates
 *
 * Real carrier rates for an order's actual parcel, so staff see the real prices before spending
 * money — and so the purchase can be one click on the cheapest.
 *
 * This exists because the buy dialog used to **invent** the rates it displayed: it built a
 * `mockRates` array client-side from a hard-coded service list and a made-up price, and staff
 * picked from that. The number on screen had no relationship to what the carrier would charge.
 *
 * Read-only — it prices a shipment without buying it, so no audit entry.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('orders:read')

    const { id } = await params

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        orderNumber: true,
        shippingCost: true,
        shippingAddress: true,
        items: { select: { productId: true, quantity: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!order.shippingAddress) {
      return NextResponse.json({ error: 'Order has no shipping address' }, { status: 400 })
    }

    const origin = await getShippingOrigin()
    if (!origin.ok) {
      return NextResponse.json({ error: describeMissingOrigin(origin.missing) }, { status: 400 })
    }

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

    // The same parcel the purchase will use, so the quoted price is the price paid.
    const parcel = calculateOrderParcel(
      buildShippingItems(order.items, new Map(products.map((p) => [p.id, p])))
    )

    const jarCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

    const client = getShippingClient()
    const rates = await client.getRates({
      fromAddress: origin.origin,
      toAddress: {
        name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim(),
        street1: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.zipCode,
        country: order.shippingAddress.country || 'US',
        phone: order.shippingAddress.phone || undefined,
      },
      parcel,
      reference: order.orderNumber,
    })

    return NextResponse.json({
      parcel,
      // What to pack, in the warehouse's own terms.
      packing: describeJarPacking(packJars(jarCount)),
      /** What the customer was charged, so an underwater label is visible before it is bought. */
      customerPaidShipping: Number(order.shippingCost),
      testMode: client.testMode,
      rates: [...rates.rates].sort((a, b) => a.rate - b.rate),
      messages: rates.messages ?? [],
    })
  } catch (error) {
    console.error('Shipping rate lookup error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Could not fetch rates',
      },
      { status: 502 }
    )
  }
}
