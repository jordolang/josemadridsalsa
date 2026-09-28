import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { createOrderNotification } from '@/lib/notifications/order-notifications'
import {
  fulfillEntireOrder,
  fulfillmentStatusFor,
  isTerminalOrderStatus,
  recordFulfillmentEvent,
  type FulfillmentTransition,
} from '@/lib/orders/fulfillment'
import { z } from 'zod'
import { BIGCOMMERCE_ORDER_LOCKED_MESSAGE } from '@/lib/bigcommerce/order-lock'
import { isBigCommerceOrderSource } from '@/lib/bigcommerce/orders'

const BulkStatusSchema = z.object({
  orderIds: z
    .array(z.string().cuid())
    .min(1, 'At least one order ID is required')
    .max(100, 'Cannot update more than 100 orders at once'),
  status: z.enum([
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ]),
  adminNote: z.string().optional(),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'orders:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { orderIds, status, adminNote } = BulkStatusSchema.parse(body)

    // Fetch all orders to validate they exist and capture previous statuses
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        userId: true,
        shippedAt: true,
        deliveredAt: true,
        importSource: true,
      },
    })

    const managedInBigCommerce = orders.filter((o) => isBigCommerceOrderSource(o.importSource))
    if (managedInBigCommerce.length > 0) {
      return NextResponse.json(
        {
          error: `${managedInBigCommerce.map((o) => o.orderNumber).join(', ')}: ${BIGCOMMERCE_ORDER_LOCKED_MESSAGE}`,
        },
        { status: 409 },
      )
    }

    const foundIds = new Set(orders.map((o) => o.id))
    const missingIds = orderIds.filter((id) => !foundIds.has(id))

    if (missingIds.length > 0) {
      return NextResponse.json(
        {
          error: `Orders not found: ${missingIds.join(', ')}`,
          missingIds,
        },
        { status: 400 }
      )
    }

    // Skip orders that already have the target status
    const ordersToUpdate = orders.filter((o) => o.status !== status)

    if (ordersToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        updated: 0,
        skipped: orders.length,
        message: 'All orders already have the requested status',
      })
    }

    const idsToUpdate = ordersToUpdate.map((o) => o.id)
    const userId = (session.user as any).id

    // Build update data with status-specific timestamp fields
    const updateData: Record<string, unknown> = {
      status,
      ...(adminNote ? { adminNotes: adminNote } : {}),
    }

    if (status === 'SHIPPED') {
      updateData.shippedAt = new Date()
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }

    // Keep fulfillment in step with the commercial status. `updateMany` cannot take
    // per-row values, so instead of forcing one fulfillment status onto the whole batch
    // the orders are partitioned and the fulfillment fields are written only to the rows
    // that should receive them.
    const transition: FulfillmentTransition | null =
      status === 'SHIPPED' ? 'shipped' : status === 'DELIVERED' ? 'delivered' : status === 'REFUNDED' ? 'returned' : null

    // Which orders in the batch this transition actually applies to. A cancelled or
    // refunded order caught up in a bulk "mark shipped" must not be marked FULFILLED, and
    // goods that never left cannot come back.
    const affected = !transition
      ? []
      : transition === 'returned'
        ? ordersToUpdate.filter((o) => o.shippedAt || o.deliveredAt)
        : ordersToUpdate.filter((o) => !isTerminalOrderStatus(o.status))

    // Perform the bulk update
    await prisma.order.updateMany({
      where: { id: { in: idsToUpdate } },
      data: updateData,
    })

    if (transition && affected.length > 0) {
      const overlay = fulfillmentStatusFor(transition)

      if (overlay) {
        // DELIVERED and RETURNED are order-level overlays; they say what happened after
        // shipping and cannot be inferred from item quantities.
        await prisma.order.updateMany({
          where: { id: { in: affected.map((o) => o.id) } },
          data: { fulfillmentStatus: overlay },
        })
      } else {
        // "Mark shipped" means every item shipped. Writing the item quantities and deriving
        // keeps the order enum and its items from disagreeing about how much went out.
        // Sequential rather than parallel: the batch is capped at 100 orders and this avoids
        // opening a connection per order against the pooler.
        for (const order of affected) {
          await fulfillEntireOrder(prisma, order.id, {
            via: 'admin:bulk-status',
            createdById: userId,
          })
        }
      }
    }

    if (transition) {
      await Promise.all(
        affected.map((o) =>
          recordFulfillmentEvent({
            orderId: o.id,
            transition,
            current: o,
            actorUserId: userId,
            eventPayload: { orderNumber: o.orderNumber, via: 'admin:bulk-status' },
          })
        )
      )
    }

    // Batch-fetch full order data for notifications (single query instead of N)
    const ordersNeedingNotification = ordersToUpdate.filter((o) => o.userId)
    const fullOrdersMap = new Map<string, Awaited<ReturnType<typeof prisma.order.findUnique>>>()

    if (ordersNeedingNotification.length > 0) {
      const fullOrders = await prisma.order.findMany({
        where: { id: { in: ordersNeedingNotification.map((o) => o.id) } },
      })
      for (const fo of fullOrders) {
        fullOrdersMap.set(fo.id, fo)
      }
    }

    // Log audit and send notifications for each updated order
    const auditAndNotifyPromises = ordersToUpdate.map(async (order) => {
      await logAudit({
        userId,
        action: 'update',
        entityType: 'order',
        entityId: order.id,
        changes: {
          status: { from: order.status, to: status },
          adminNote,
          bulkUpdate: true,
        },
      })

      // Send notification to the order's user if applicable
      if (order.userId) {
        try {
          const fullOrder = fullOrdersMap.get(order.id)
          if (fullOrder) {
            await createOrderNotification(
              order.userId,
              'ORDER_STATUS_CHANGE',
              fullOrder
            )
          }
        } catch (notifError) {
          console.error(
            `Failed to send notification for order ${order.id}:`,
            notifError
          )
        }
      }
    })

    await Promise.all(auditAndNotifyPromises)

    return NextResponse.json({
      success: true,
      updated: ordersToUpdate.length,
      skipped: orders.length - ordersToUpdate.length,
      updatedOrders: ordersToUpdate.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        previousStatus: o.status,
        newStatus: status,
      })),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error('Bulk status update error:', error)
    return NextResponse.json(
      { error: 'Failed to update order statuses' },
      { status: 500 }
    )
  }
}
