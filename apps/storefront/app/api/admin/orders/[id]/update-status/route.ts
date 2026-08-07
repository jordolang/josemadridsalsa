import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, type UserRole } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import {
  buildFulfillmentUpdate,
  fulfillEntireOrder,
  isDerivedTransition,
  recordFulfillmentEvent,
  transitionForOrderStatus,
} from '@/lib/orders/fulfillment'
import { z } from 'zod'
import {
  sendOrderCancellationEmail,
  sendRefundProcessedEmail,
} from '@/lib/email/transactional'

const UpdateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  adminNote: z.string().optional(),
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

    const permitted = await hasPermission(session.user as unknown as { role: UserRole }, 'orders:write')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status, adminNote } = UpdateStatusSchema.parse(body)

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, name: true } },
        payments: {
          select: { amount: true, methodType: true, provider: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const previousStatus = order.status

    // Fulfillment state is derived from the chosen status rather than set independently,
    // so `status` and `fulfillmentStatus` cannot drift apart. The admin picked the
    // commercial status here, so it wins — hence syncOrderStatus: false.
    const transition = transitionForOrderStatus(status, order)
    const fulfillmentUpdate = transition
      ? buildFulfillmentUpdate({ transition, current: order, syncOrderStatus: false })
      : {}

    // buildFulfillmentUpdate already stamps shippedAt/deliveredAt and guards against
    // restamping, so no timestamp handling belongs here.
    const updateData: Record<string, unknown> = { status, ...fulfillmentUpdate }
    if (adminNote) updateData.adminNotes = adminNote

    const updated = await prisma.order.update({
      where: { id },
      data: updateData,
    })

    // A derived transition ("shipped") means every item shipped; the order enum then comes
    // from the items rather than being asserted alongside them.
    if (transition && isDerivedTransition(transition)) {
      await fulfillEntireOrder(prisma, id, {
        via: 'admin:update-status',
        createdById: (session.user as { id: string }).id,
      })
    }

    if (transition) {
      await recordFulfillmentEvent({
        orderId: id,
        transition,
        current: order,
        actorUserId: (session.user as { id: string }).id,
        eventPayload: { orderNumber: order.orderNumber, via: 'admin:update-status' },
      })
    }

    await logAudit({
      userId: (session.user as { id: string }).id,
      action: 'update',
      entityType: 'order',
      entityId: id,
      changes: { status: { from: previousStatus, to: status }, adminNote },
    })

    // Fire transactional emails when status changes to terminal states
    const recipientEmail = order.user?.email ?? order.guestEmail
    const recipientName = order.user?.name ?? 'there'

    if (recipientEmail && previousStatus !== status) {
      if (status === 'CANCELLED') {
        sendOrderCancellationEmail({
          email: recipientEmail,
          name: recipientName,
          orderNumber: order.orderNumber,
        }).catch((err: unknown) => {
          console.error('Cancellation email failed for order', order.orderNumber, err)
        })
      } else if (status === 'REFUNDED') {
        const payment = order.payments[0]
        const refundAmount = payment
          ? `$${Number(payment.amount).toFixed(2)}`
          : `$${Number(order.total).toFixed(2)}`
        const refundMethod = payment?.methodType ?? payment?.provider ?? 'original payment method'
        const originalOrderDate = order.createdAt.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })

        sendRefundProcessedEmail({
          email: recipientEmail,
          name: recipientName,
          orderNumber: order.orderNumber,
          refundAmount,
          refundMethod,
          originalOrderDate,
        }).catch((err: unknown) => {
          console.error('Refund email failed for order', order.orderNumber, err)
        })
      }
    }

    return NextResponse.json({ success: true, status: updated.status })
  } catch (error) {
    console.error('Update order status error:', error)
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }
}
