import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { adjustInventory } from '@/lib/inventory-manager'
import { canTransitionReturn, planRestock } from '@/lib/orders/returns'

const UpdateReturnSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED', 'CANCELLED']),
  adminNote: z.string().trim().max(2000).optional(),
  restockingFee: z.number().min(0).optional(),
  /** Condition per line, recorded when moving to RECEIVED so restocking can be decided. */
  itemConditions: z
    .array(
      z.object({
        returnRequestItemId: z.string().cuid(),
        condition: z.enum(['RESELLABLE', 'DAMAGED', 'DISCARDED']),
      })
    )
    .optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'orders:read'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const returnRequest = await prisma.returnRequest.findUnique({
    where: { id },
    include: {
      order: { select: { id: true, orderNumber: true } },
      items: { include: { orderItem: true } },
      refund: true,
    },
  })

  if (!returnRequest) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 })
  }

  return NextResponse.json({ returnRequest })
}

/**
 * Advance a return through its lifecycle.
 *
 * Restocking happens on the move to COMPLETED, driven by the condition recorded at receipt,
 * and goes through `adjustInventory` rather than incrementing stock directly so the
 * inventory transaction record is written and low-stock alerts still evaluate.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'orders:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = UpdateReturnSchema.parse(await request.json())

    const existing = await prisma.returnRequest.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true } },
        items: { include: { orderItem: { select: { productId: true, productName: true } } } },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Return not found' }, { status: 404 })
    }

    if (!canTransitionReturn(existing.status, body.status)) {
      return NextResponse.json(
        {
          error: `A ${existing.status.toLowerCase()} return cannot move to ${body.status.toLowerCase()}`,
        },
        { status: 409 }
      )
    }

    const now = new Date()
    const timestamps =
      body.status === 'APPROVED'
        ? { approvedAt: now, approvedById: user.id }
        : body.status === 'RECEIVED'
          ? { receivedAt: now }
          : body.status === 'COMPLETED'
            ? { completedAt: now }
            : {}

    // Conditions are recorded first so the restock plan below sees them.
    if (body.itemConditions?.length) {
      await prisma.$transaction(
        body.itemConditions.map((line) =>
          prisma.returnRequestItem.update({
            where: { id: line.returnRequestItemId },
            data: { condition: line.condition },
          })
        )
      )
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.adminNote !== undefined ? { adminNote: body.adminNote } : {}),
        ...(body.restockingFee !== undefined ? { restockingFee: body.restockingFee } : {}),
        ...timestamps,
      },
      include: { items: { include: { orderItem: { select: { productId: true } } } } },
    })

    const restocked: { productId: string; quantity: number; type: string }[] = []

    if (body.status === 'COMPLETED') {
      const plan = planRestock(
        updated.items.map((item) => ({
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          condition: item.condition,
          restocked: item.restocked,
        }))
      )

      const productByOrderItem = new Map(
        updated.items.map((item) => [item.orderItemId, item.orderItem.productId])
      )

      for (const decision of plan) {
        const productId = productByOrderItem.get(decision.orderItemId)
        if (!productId) continue

        // Only resellable units move stock. A unit that came back damaged was already
        // deducted when it shipped and never re-enters sellable stock, so there is nothing
        // to write off — recording an inventory transaction for it would double-count the
        // loss. The damage itself is recorded on the return line's condition.
        if (decision.addsToSellableStock) {
          await adjustInventory({
            productId,
            quantity: decision.quantity,
            type: decision.transactionType,
            reason: `Return ${existing.rmaNumber}`,
            notes: 'Returned in resellable condition',
            orderId: existing.orderId,
            userId: user.id,
          })
        }

        // Marked either way: the line has been dispositioned, so re-running completion
        // cannot restock it a second time.
        await prisma.returnRequestItem.updateMany({
          where: { returnRequestId: id, orderItemId: decision.orderItemId },
          data: { restocked: true },
        })

        restocked.push({
          productId,
          quantity: decision.quantity,
          type: decision.transactionType,
        })
      }
    }

    await emitDomainEvent({
      type: 'order.returned',
      entityType: 'order',
      entityId: existing.orderId,
      actorUserId: user.id,
      payload: {
        rmaNumber: existing.rmaNumber,
        returnRequestId: id,
        status: body.status,
        restockedLines: restocked.length,
      },
    })

    await logAuditWithRequest(
      {
        userId: user.id,
        action: 'update',
        entityType: 'return_request',
        entityId: id,
        changes: {
          rmaNumber: existing.rmaNumber,
          status: { from: existing.status, to: body.status },
          orderNumber: existing.order.orderNumber,
          restocked,
        },
      },
      request
    )

    return NextResponse.json({ returnRequest: updated, restocked })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Update return error:', error)
    return NextResponse.json({ error: 'Failed to update return request' }, { status: 500 })
  }
}
