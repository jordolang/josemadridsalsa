import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { dedupeKeys, notifyOperators, severityFor } from '@/lib/notifications/dispatch'
import {
  generateRmaNumber,
  validateReturnRequest,
  type ReturnableOrderItem,
} from '@/lib/orders/returns'

const CreateReturnSchema = z.object({
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
  resolution: z.enum(['REFUND', 'EXCHANGE', 'STORE_CREDIT']).default('REFUND'),
  items: z
    .array(
      z.object({
        orderItemId: z.string().cuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  customerNote: z.string().trim().max(2000).optional(),
  adminNote: z.string().trim().max(2000).optional(),
  restockingFee: z.number().min(0).optional(),
  /** Staff may accept a return past the window; this is why that is an explicit choice. */
  ignoreWindow: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'orders:read'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get('status')
  const returns = await prisma.returnRequest.findMany({
    where: status && status !== 'all' ? { status: status as never } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      order: { select: { orderNumber: true, guestEmail: true, user: { select: { name: true } } } },
      items: true,
    },
  })

  return NextResponse.json({ returns })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = CreateReturnSchema.parse(await request.json())

    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
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
              // Only live returns hold a claim on the units; a rejected or cancelled
              // request frees them to be returned again.
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
      ignoreWindow: body.ignoreWindow,
    })

    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error.message, details: validation.error },
        { status: 400 }
      )
    }

    const returnRequest = await prisma.returnRequest.create({
      data: {
        rmaNumber: generateRmaNumber(new Date()),
        orderId: order.id,
        reason: body.reason,
        resolution: body.resolution,
        customerNote: body.customerNote ?? null,
        adminNote: body.adminNote ?? null,
        restockingFee: body.restockingFee ?? null,
        requestedById: user.id,
        items: {
          create: [...validation.quantities].map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          })),
        },
      },
      include: { items: true },
    })

    await emitDomainEvent({
      type: 'order.returned',
      entityType: 'order',
      entityId: order.id,
      actorUserId: user.id,
      payload: {
        rmaNumber: returnRequest.rmaNumber,
        returnRequestId: returnRequest.id,
        reason: body.reason,
        status: 'REQUESTED',
      },
    })

    await notifyOperators({
      type: 'RETURN_REQUESTED',
      severity: severityFor('RETURN_REQUESTED'),
      title: 'Return requested',
      message: `${returnRequest.rmaNumber} on order ${order.orderNumber}`,
      entityType: 'return_request',
      entityId: returnRequest.id,
      link: `/admin/returns/${returnRequest.id}`,
      dedupeKey: dedupeKeys.returnRequested(returnRequest.id),
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'create',
        entityType: 'return_request',
        entityId: returnRequest.id,
        changes: {
          rmaNumber: returnRequest.rmaNumber,
          orderNumber: order.orderNumber,
          reason: body.reason,
          items: Object.fromEntries(validation.quantities),
        },
      },
      request
    )

    return NextResponse.json({ returnRequest }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Create return error:', error)
    return NextResponse.json({ error: 'Failed to create return request' }, { status: 500 })
  }
}
