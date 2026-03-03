import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { sendOrderConfirmationEmail } from '@/lib/email/automation'

/**
 * Webhook Event Handler Types
 */
export type WebhookHandlerResult = {
  success: boolean
  message?: string
}

/**
 * Handle successful payment intent
 * Updates order status, inventory, and sends confirmation email
 */
export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookHandlerResult> {
  const orderId = paymentIntent.metadata?.orderId

  if (!orderId) {
    console.warn('Payment intent missing orderId in metadata:', paymentIntent.id)
    return { success: true, message: 'Missing orderId in metadata' }
  }

  // Find the order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      giftCertificates: true,
    },
  })

  if (!order) {
    console.error('Order not found for payment intent:', paymentIntent.id, 'orderId:', orderId)
    return { success: true, message: 'Order not found' }
  }

  // Skip if already paid (idempotency)
  if (order.paymentStatus === 'PAID') {
    console.log('Order already marked as paid:', orderId)
    return { success: true, message: 'Order already paid' }
  }

  // Update order status in a transaction
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        stripePaymentId: paymentIntent.id,
      },
    })

    // Update inventory for product orders (not gift certificates)
    if (order.items.length > 0) {
      await Promise.all(
        order.items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: {
              inventory: { decrement: item.quantity },
            },
          })
        )
      )
    }

    // Gift certificates are already created, no additional action needed
  })

  console.log('Order payment confirmed via webhook:', orderId)

  // Send confirmation email if not already sent
  if (!order.confirmationEmailSentAt) {
    sendOrderConfirmationEmail(order.id).catch((error) => {
      console.error('Failed to send confirmation email', { orderId, error })
    })
  }

  return { success: true, message: 'Payment processed successfully' }
}

/**
 * Handle failed payment intent
 * Updates order payment status to FAILED
 */
export async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookHandlerResult> {
  const orderId = paymentIntent.metadata?.orderId

  if (!orderId) {
    console.warn('Payment intent missing orderId in metadata:', paymentIntent.id)
    return { success: true, message: 'Missing orderId in metadata' }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'FAILED',
    },
  })

  console.log('Order payment failed via webhook:', orderId)
  return { success: true, message: 'Payment failure recorded' }
}

/**
 * Handle canceled payment intent
 * Updates order payment status to FAILED and order status to CANCELLED
 */
export async function handlePaymentIntentCanceled(
  paymentIntent: Stripe.PaymentIntent
): Promise<WebhookHandlerResult> {
  const orderId = paymentIntent.metadata?.orderId

  if (!orderId) {
    console.warn('Payment intent missing orderId in metadata:', paymentIntent.id)
    return { success: true, message: 'Missing orderId in metadata' }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'FAILED',
      status: 'CANCELLED',
    },
  })

  console.log('Order payment canceled via webhook:', orderId)
  return { success: true, message: 'Payment cancellation recorded' }
}

/**
 * Handle charge refund
 * Updates order status, restores inventory for full refunds, and creates audit log
 */
export async function handleChargeRefunded(
  charge: Stripe.Charge
): Promise<WebhookHandlerResult> {
  const orderId = charge.metadata?.orderId

  if (!orderId) {
    console.warn('Skipping refund processing: charge missing orderId in metadata:', charge.id)
    return { success: true, message: 'Missing orderId in metadata' }
  }

  const isFullRefund = charge.amount_refunded === charge.amount
  const refundId = charge.refunds?.data[0]?.id

  if (!refundId) {
    console.warn('Skipping refund processing: no refund ID found in charge:', charge.id)
    return { success: true, message: 'No refund ID found' }
  }

  // Fetch order with items to restore inventory
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order) {
    console.error('Order not found for refund:', orderId)
    return { success: true, message: 'Order not found' }
  }

  await prisma.$transaction(async (tx) => {
    // Check if refund was already processed (idempotency check)
    // This prevents duplicate inventory restoration if the same webhook is delivered multiple times
    const existingAudit = await tx.auditLog.findFirst({
      where: {
        action: 'webhook.refund',
        entityId: orderId,
        changes: {
          path: ['refundId'],
          equals: refundId,
        },
      },
    })

    if (existingAudit) {
      console.log('Refund already processed, skipping:', refundId, 'for order:', orderId)
      return // Already processed
    }

    // Update order status
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: isFullRefund ? 'REFUNDED' : order.status,
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    })

    // Restore inventory on full refunds only
    // Note: Partial refunds do not restore inventory as they may not correspond to specific items being returned.
    // For partial refunds, inventory must be manually adjusted by an administrator.
    if (isFullRefund && order.items.length > 0) {
      await Promise.all(
        order.items.map((item) =>
          tx.product.update({
            where: { id: item.productId },
            data: {
              inventory: { increment: item.quantity },
            },
          })
        )
      )
    }

    // Create audit log entry to track this refund processing
    await tx.auditLog.create({
      data: {
        action: 'webhook.refund',
        entityType: 'order',
        entityId: orderId,
        changes: {
          refundId,
          chargeId: charge.id,
          isFullRefund,
          amountRefunded: charge.amount_refunded,
          inventoryRestored: isFullRefund && order.items.length > 0,
        },
      },
    })
  })

  console.log('Order refund processed via webhook:', orderId, isFullRefund ? 'FULL' : 'PARTIAL')
  return { success: true, message: 'Refund processed successfully' }
}

/**
 * Verify webhook signature
 * Throws error if signature verification fails
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  webhookSecret: string,
  stripe: Stripe
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const error = err as Error
    console.error('Webhook signature verification failed:', error.message)
    throw new Error(`Webhook signature verification failed: ${error.message}`)
  }
}

/**
 * Process webhook event by type
 * Routes to appropriate handler based on event type
 */
export async function processWebhookEvent(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      return await handlePaymentIntentSucceeded(paymentIntent)
    }

    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      return await handlePaymentIntentFailed(paymentIntent)
    }

    case 'payment_intent.canceled': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      return await handlePaymentIntentCanceled(paymentIntent)
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      return await handleChargeRefunded(charge)
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
      return { success: true, message: 'Event type not handled' }
  }
}
