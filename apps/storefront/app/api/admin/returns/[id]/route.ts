import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAuditWithRequest } from '@/lib/audit'
import { emitDomainEvent } from '@/lib/domain-events/emit'
import { adjustInventory } from '@/lib/inventory-manager'
import { canTransitionReturn, planRestock } from '@/lib/orders/returns'
import { REFUNDABLE_PAYMENT_STATUSES } from '@/lib/payments/refund'
import { planResolution } from '@/lib/orders/return-resolution'
import {
  ReturnSettlementError,
  settleReturn,
  type ResolutionSettlement,
} from '@/lib/orders/settle-return.server'

const UpdateReturnSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'RECEIVED', 'COMPLETED', 'CANCELLED']),
  adminNote: z.string().trim().max(2000).optional(),
  restockingFee: z.number().min(0).optional(),
  /**
   * Changeable up until the return settles. Customer-raised returns are always created as
   * REFUND — the customer is not offered a choice — so without this, store credit and exchange
   * would only ever be reachable on staff-raised returns.
   */
  resolution: z.enum(['REFUND', 'EXCHANGE', 'STORE_CREDIT']).optional(),
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
        order: {
          select: {
            id: true,
            orderNumber: true,
            userId: true,
            guestEmail: true,
            shippingAddressId: true,
            payments: {
              // Includes PARTIALLY_REFUNDED: a second partial return against the same order
              // still has balance to refund, and filtering on SUCCEEDED alone hid it.
              where: { status: { in: REFUNDABLE_PAYMENT_STATUSES } },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            },
            user: { select: { name: true, email: true } },
          },
        },
        exchangeOrder: { select: { id: true } },
        items: {
          include: {
            orderItem: {
              select: {
                productId: true,
                productName: true,
                productSku: true,
                unitPrice: true,
                unitCost: true,
                productImage: true,
              },
            },
          },
        },
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

    // Settle the money before recording completion. Refusing here leaves the return in
    // RECEIVED, which is recoverable; recording it COMPLETED and then failing to pay the
    // customer is not, because COMPLETED is terminal and cannot be re-driven.
    let settlement: ResolutionSettlement | null = null

    // The resolution in force for this request, which may be the one just chosen.
    const resolution = body.resolution ?? existing.resolution

    // Changing it after the return has produced money would leave the record describing an
    // outcome that did not happen.
    if (body.resolution && body.resolution !== existing.resolution) {
      const alreadySettled =
        existing.refundId || existing.giftCertificateId || existing.exchangeOrder?.id
      if (alreadySettled) {
        return NextResponse.json(
          { error: 'This return has already been settled, so its resolution cannot change.' },
          { status: 409 }
        )
      }
    }

    if (body.status === 'COMPLETED') {
      const restockingFeeCents = Math.round(
        Number(body.restockingFee ?? existing.restockingFee ?? 0) * 100
      )

      const plan = planResolution(resolution, {
        refundId: existing.refundId,
        giftCertificateId: existing.giftCertificateId,
        exchangeOrderId: existing.exchangeOrder?.id ?? null,
      })

      if (!plan.ok) {
        // An outcome that already happened is not an error worth blocking on — it means
        // completion is being re-driven after a partial failure. A *conflicting* outcome is.
        if (plan.block.code === 'CONFLICTING_OUTCOME') {
          return NextResponse.json({ error: plan.block.message }, { status: 409 })
        }
      } else {
        try {
          settlement = await settleReturn({
            outcome: plan.outcome,
            returnRequest: existing,
            restockingFeeCents,
            actorUserId: user.id,
          })
        } catch (error) {
          if (error instanceof ReturnSettlementError) {
            return NextResponse.json({ error: error.message }, { status: error.status })
          }
          throw error
        }
      }
    }

    const updated = await prisma.returnRequest.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.adminNote !== undefined ? { adminNote: body.adminNote } : {}),
        ...(body.restockingFee !== undefined ? { restockingFee: body.restockingFee } : {}),
        ...(body.resolution ? { resolution: body.resolution } : {}),
        ...(settlement?.refundId ? { refundId: settlement.refundId } : {}),
        ...(settlement?.giftCertificateId
          ? { giftCertificateId: settlement.giftCertificateId }
          : {}),
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
        resolution,
        // Carried on the existing event rather than as a new type: the domain-event catalogue
        // is owned by the automation work, and this detail belongs to a fact it already records.
        settledAs: settlement?.outcome ?? null,
        settledValueCents: settlement?.valueCents ?? null,
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
          ...(settlement
            ? {
                settlement: {
                  outcome: settlement.outcome,
                  valueCents: settlement.valueCents,
                  refundId: settlement.refundId ?? null,
                  giftCertificateId: settlement.giftCertificateId ?? null,
                  storeCreditCode: settlement.storeCreditCode ?? null,
                  exchangeOrderNumber: settlement.exchangeOrderNumber ?? null,
                },
              }
            : {}),
        },
      },
      request
    )

    return NextResponse.json({ returnRequest: updated, restocked, settlement })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Update return error:', error)
    return NextResponse.json({ error: 'Failed to update return request' }, { status: 500 })
  }
}
