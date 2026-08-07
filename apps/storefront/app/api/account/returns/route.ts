import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { dedupeKeys, notifyOperators, severityFor } from '@/lib/notifications/dispatch'
import {
  generateRmaNumber,
  validateReturnRequest,
  type ReturnableOrderItem,
} from '@/lib/orders/returns'

const CustomerReturnSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.enum([
    'DAMAGED',
    'WRONG_ITEM',
    'NOT_AS_DESCRIBED',
    'ARRIVED_LATE',
    'CHANGED_MIND',
    'QUALITY_ISSUE',
    'OTHER',
  ]),
  items: z
    .array(z.object({ orderItemId: z.string().cuid(), quantity: z.number().int().positive() }))
    .min(1),
  note: z.string().trim().max(1000).optional(),
})

/**
 * Customer-initiated return request.
 *
 * Deliberately narrower than the admin route: the customer chooses items and a reason, and
 * nothing else. Resolution, restocking fees and the window override stay with staff, and
 * the request always lands as REQUESTED for a human to approve — a customer cannot approve
 * their own return.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Please sign in' }, { status: 401 })
    }

    const userId = (session.user as { id: string }).id
    const body = CustomerReturnSchema.parse(await request.json())

    // Scoped by userId: a customer may only open a return against their own order, and a
    // guessed order id resolves to nothing rather than leaking that it exists.
    const order = await prisma.order.findFirst({
      where: { id: body.orderId, userId },
      select: {
        id: true,
        orderNumber: true,
        shippedAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            quantityFulfilled: true,
            unitPrice: true,
            returnItems: {
              where: { returnRequest: { status: { notIn: ['REJECTED', 'CANCELLED'] } } },
              select: { quantity: true },
            },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const returnableItems: ReturnableOrderItem[] = order.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      quantityFulfilled: item.quantityFulfilled,
      unitPrice: Number(item.unitPrice),
      quantityReturned: item.returnItems.reduce((sum, r) => sum + r.quantity, 0),
    }))

    const validation = validateReturnRequest({
      lines: body.items,
      orderItems: returnableItems,
      fulfilledAt: order.shippedAt,
      // Customers get the published window; only staff can accept a late return.
      ignoreWindow: false,
    })

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 })
    }

    const returnRequest = await prisma.returnRequest.create({
      data: {
        rmaNumber: generateRmaNumber(new Date()),
        orderId: order.id,
        reason: body.reason,
        resolution: 'REFUND',
        customerNote: body.note ?? null,
        requestedById: userId,
        items: {
          create: [...validation.quantities].map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          })),
        },
      },
      select: { id: true, rmaNumber: true, status: true },
    })

    await emitDomainEvent({
      type: 'order.returned',
      entityType: 'order',
      entityId: order.id,
      actorUserId: userId,
      payload: {
        rmaNumber: returnRequest.rmaNumber,
        returnRequestId: returnRequest.id,
        reason: body.reason,
        status: 'REQUESTED',
        via: 'customer',
      },
    })

    // Staff need to know without watching the queue; this is the point of the notification
    // centre existing.
    await notifyOperators({
      type: 'RETURN_REQUESTED',
      severity: severityFor('RETURN_REQUESTED'),
      title: 'Customer requested a return',
      message: `${returnRequest.rmaNumber} on order ${order.orderNumber}`,
      entityType: 'return_request',
      entityId: returnRequest.id,
      link: `/admin/returns/${returnRequest.id}`,
      dedupeKey: dedupeKeys.returnRequested(returnRequest.id),
    })

    return NextResponse.json({ returnRequest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Customer return request error:', error)
    return NextResponse.json({ error: 'Could not submit your return request' }, { status: 500 })
  }
}
