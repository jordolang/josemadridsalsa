/**
 * Domain events → "your refund has gone through".
 *
 * A refund executed through `refundPaymentInTx` — the admin refund form, or a return being
 * settled — moved the money and told the customer nothing. The only thing that sent this email
 * was an admin manually flipping an order's status to REFUNDED, which is a different action
 * entirely and can happen without any money moving.
 *
 * Both now write `Order.refundEmailSentAt`, so whichever happens first sends and the other stays
 * quiet. Without a shared marker a customer gets two "your refund was processed" emails for one
 * refund, which reads as two refunds.
 */
import { prisma } from '@/lib/prisma'
import { sendRefundProcessedEmail } from '@/lib/email/transactional'

import { registerDomainEventHandler } from '../subscribe'
import type { DomainEventRecord } from '../subscribe'

function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Tell the customer their refund settled.
 *
 * Idempotent through `refundEmailSentAt`, stamped after the send so a crash in between repeats
 * the email rather than silently swallowing it.
 */
export async function handleRefundNotification(event: DomainEventRecord): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: event.entityId },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      createdAt: true,
      guestEmail: true,
      refundEmailSentAt: true,
      user: { select: { name: true, email: true } },
      payments: { select: { methodType: true, provider: true }, take: 1 },
    },
  })

  if (!order || order.refundEmailSentAt) return

  const email = order.user?.email ?? order.guestEmail
  if (!email) return

  const payload =
    event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {}

  // The event carries what was actually refunded, which is not always the order total — a
  // partial refund on a three-jar order should not tell the customer the whole order came back.
  const amountCents = readNumber(payload, 'amountCents')
  const refundAmount =
    amountCents !== null
      ? `$${(amountCents / 100).toFixed(2)}`
      : `$${Number(order.total).toFixed(2)}`

  const payment = order.payments[0]

  await sendRefundProcessedEmail({
    email,
    name: order.user?.name ?? 'there',
    orderNumber: order.orderNumber,
    refundAmount,
    refundMethod: payment?.methodType ?? payment?.provider ?? 'original payment method',
    originalOrderDate: order.createdAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  })

  await prisma.order.update({
    where: { id: order.id },
    data: { refundEmailSentAt: new Date() },
  })
}

/** Subscribe to a refund actually settling at the processor. */
export function registerRefundNotificationHandlers(): void {
  registerDomainEventHandler('payment.refunded', 'refund-notification', handleRefundNotification)
}
