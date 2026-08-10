import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAuditWithRequest } from '@/lib/audit'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import {
  buildFulfillmentUpdate,
  fulfillOrderItems,
  validateFulfillmentRequest,
} from '@/lib/orders/fulfillment'

const CreateFulfillmentSchema = z.object({
  items: z
    .array(
      z.object({
        orderItemId: z.string().cuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'Select at least one item to fulfill'),
  carrierName: z.string().trim().max(100).optional(),
  trackingNumber: z.string().trim().max(200).optional(),
  trackingUrl: z.string().trim().url().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
})

/**
 * Record a shipment covering some subset of an order's items.
 *
 * This is what makes PARTIALLY_FULFILLED reachable: the order-level "mark shipped" paths
 * fulfill everything at once, whereas this endpoint ships what is actually in the box.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(await hasPermission(session.user as any, 'orders:write'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = CreateFulfillmentSchema.parse(await request.json())

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        shippedAt: true,
        deliveredAt: true,
        items: { select: { id: true, quantity: true, quantityFulfilled: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Goods do not leave on an order that has been called off.
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      return NextResponse.json(
        { error: `Cannot fulfill a ${order.status.toLowerCase()} order` },
        { status: 409 }
      )
    }

    const validation = validateFulfillmentRequest(body.items, order.items)
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error.message, details: validation.error },
        { status: 400 }
      )
    }

    // A resubmitted form must not ship the same box twice. When a tracking number is
    // supplied it identifies the shipment, so an existing fulfillment carrying it means
    // this request already succeeded — return that rather than double-incrementing.
    if (body.trackingNumber) {
      const existing = await prisma.fulfillment.findFirst({
        where: { orderId: id, trackingNumber: body.trackingNumber },
        include: { items: true },
      })
      if (existing) {
        return NextResponse.json({ fulfillment: existing, deduplicated: true })
      }
    }

    const userId = (session.user as { id: string }).id
    const now = new Date()

    const { fulfillment, fulfillmentStatus } = await prisma.$transaction(async (tx) => {
      const created = await tx.fulfillment.create({
        data: {
          orderId: id,
          status: 'FULFILLED',
          carrierName: body.carrierName ?? null,
          trackingNumber: body.trackingNumber ?? null,
          trackingUrl: body.trackingUrl ?? null,
          notes: body.notes ?? null,
          createdById: userId,
          shippedAt: now,
          items: {
            create: [...validation.quantities].map(([orderItemId, quantity]) => ({
              orderItemId,
              quantity,
            })),
          },
        },
        include: { items: true },
      })

      // Increments the item balances and re-derives Order.fulfillmentStatus from them.
      const status = await fulfillOrderItems(tx, id, validation.quantities)

      // Timestamps and the commercial status still come from the shared helper, so this
      // path cannot drift from the six order-level writers.
      const orderUpdate = buildFulfillmentUpdate({
        transition: status === 'FULFILLED' ? 'shipped' : 'partially_shipped',
        current: order,
        now,
      })
      if (Object.keys(orderUpdate).length > 0) {
        await tx.order.update({ where: { id }, data: orderUpdate })
      }

      if (body.trackingNumber) {
        await tx.order.update({ where: { id }, data: { trackingNumber: body.trackingNumber } })
      }

      return { fulfillment: created, fulfillmentStatus: status }
    })

    await emitDomainEvent({
      type: fulfillmentStatus === 'FULFILLED' ? 'order.fulfilled' : 'order.partially_fulfilled',
      entityType: 'order',
      entityId: id,
      actorUserId: userId,
      payload: {
        orderNumber: order.orderNumber,
        fulfillmentId: fulfillment.id,
        trackingNumber: body.trackingNumber ?? null,
        carrier: body.carrierName ?? null,
        units: [...validation.quantities.values()].reduce((sum, n) => sum + n, 0),
        via: 'admin:fulfillments',
      },
    })

    await logAuditWithRequest(
      {
        userId,
        action: 'create',
        entityType: 'fulfillment',
        entityId: fulfillment.id,
        changes: {
          orderId: id,
          orderNumber: order.orderNumber,
          items: Object.fromEntries(validation.quantities),
          trackingNumber: body.trackingNumber ?? null,
          fulfillmentStatus,
        },
      },
      request
    )

    return NextResponse.json({ fulfillment, fulfillmentStatus }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Create fulfillment error:', error)
    return NextResponse.json({ error: 'Failed to record fulfillment' }, { status: 500 })
  }
}
