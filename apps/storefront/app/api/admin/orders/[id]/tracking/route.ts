import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { buildFulfillmentUpdate, recordFulfillmentEvent } from '@/lib/orders/fulfillment'
import { z } from 'zod'

const TrackingSchema = z.object({
  trackingNumber: z.string().min(1, 'Tracking number is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  trackingUrl: z.string().url().optional(),
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
    const body = await request.json()
    const { trackingNumber, carrier, trackingUrl, updateStatus } = TrackingSchema.parse(body)

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

    if (shouldAdvance) {
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
        ...(updateData.status ? { status: { from: order.status, to: 'SHIPPED' } } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      trackingNumber: updated.trackingNumber,
      status: updated.status,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Update tracking error:', error)
    return NextResponse.json({ error: 'Failed to save tracking information' }, { status: 500 })
  }
}
