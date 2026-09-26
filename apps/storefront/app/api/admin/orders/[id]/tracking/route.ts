import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { buildFulfillmentUpdate, fulfillEntireOrder, recordFulfillmentEvent } from '@/lib/orders/fulfillment'
import { EXTERNAL_LABEL_SOURCE } from '@/lib/shipping/rate-selection'
import { z } from 'zod'
import { bigCommerceOrderLock } from '@/lib/bigcommerce/order-lock'

/**
 * Postage bought outside the system.
 *
 * Pirate Ship has no API and rates well below anything reachable programmatically, so buying there
 * and pasting the result back in is a first-class way to fulfil an order, not a workaround. The
 * only thing that cannot be automated is the purchase itself.
 *
 * `costPaid` is what matters beyond the tracking number: it is what *we* paid, which is a different
 * number from `Order.shippingCost` — what the *customer* paid — and margin needs both. Without it a
 * Pirate Ship shipment looks free.
 */
const TrackingSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required').max(100),
  carrier: z.string().min(1, 'Carrier is required').max(60),
  /** e.g. "Ground Advantage". Free text, because an external carrier's service names are its own. */
  service: z.string().max(60).optional(),
  trackingUrl: z.string().url().optional(),
  /** Dollars actually paid for the postage. Optional, but margin is blind without it. */
  costPaid: z.number().min(0).max(10_000).optional(),
  updateStatus: z.boolean().optional().default(true),
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
    const body = await request.json()
    const { trackingNumber, carrier, service, trackingUrl, costPaid, updateStatus } =
      TrackingSchema.parse(body)

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const previousTracking = order.trackingNumber

    const updateData: Record<string, unknown> = {
      trackingNumber,
      // Store the live tracking URL in shippingLabelUrl for display
      shippingLabelUrl: trackingUrl || null,
    }

    // Auto-advance to SHIPPED when adding tracking if order is not yet shipped/delivered.
    // buildFulfillmentUpdate sets status, fulfillmentStatus and shippedAt together so
    // this route cannot advance one without the others.
    const shouldAdvance =
      updateStatus &&
      order.status !== 'SHIPPED' &&
      order.status !== 'DELIVERED' &&
      order.status !== 'CANCELLED' &&
      order.status !== 'REFUNDED'

    if (shouldAdvance) {
      Object.assign(updateData, buildFulfillmentUpdate({ transition: 'shipped', current: order }))
    }

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
    })

    // A shipment record for postage bought elsewhere, so the money we spent is not invisible.
    //
    // `trackingCode` is deliberately left null: that column means "an EasyPost shipment we can
    // track", and the tracking webhook matches on it. A Pirate Ship label is not in our EasyPost
    // account, so filling it would create a shipment the webhook waits forever to hear about.
    const externalLabel = await prisma.shippingLabel.create({
      data: {
        orderId: id,
        trackingNumber,
        carrierName: carrier,
        serviceName: service ?? null,
        labelUrl: trackingUrl ?? null,
        cost: costPaid ?? null,
        shipDate: new Date(),
        status: 'purchased_externally',
        carrierResponse: {
          source: EXTERNAL_LABEL_SOURCE,
          carrier,
          service: service ?? null,
          trackingUrl: trackingUrl ?? null,
          costPaid: costPaid ?? null,
        },
        createdById: (session.user as any).id,
      },
      select: { id: true },
    })

    if (shouldAdvance) {
      await fulfillEntireOrder(prisma, id, {
        via: 'admin:tracking',
        createdById: (session.user as any).id,
      })

      await recordFulfillmentEvent({
        orderId: id,
        transition: 'shipped',
        current: order,
        actorUserId: (session.user as any).id,
        eventPayload: { orderNumber: order.orderNumber, trackingNumber, carrier, via: 'admin:tracking' },
      })
    }

    await logAudit({
      userId: (session.user as any).id,
      action: 'update',
      entityType: 'order',
      entityId: id,
      changes: {
        trackingNumber: { from: previousTracking, to: trackingNumber },
        carrier,
        service: service ?? null,
        // What we paid, recorded so the spend is auditable and not only inferable from the label.
        costPaid: costPaid ?? null,
        shippingLabelId: externalLabel.id,
        ...(updateData.status ? { status: { from: order.status, to: 'SHIPPED' } } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      trackingNumber: updated.trackingNumber,
      status: updated.status,
      shippingLabelId: externalLabel.id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Update tracking error:', error)
    return NextResponse.json({ error: 'Failed to save tracking information' }, { status: 500 })
  }
}
