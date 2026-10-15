import { OrderStatus, type FulfillmentStatus } from '@prisma/client'
import prisma from '@/lib/prisma'
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from '@/lib/email/automation'
import {
  buildFulfillmentUpdate,
  fulfillEntireOrder,
  isDerivedTransition,
  recordFulfillmentEvent,
  type FulfillmentTransition,
} from '@/lib/orders/fulfillment'

/**
 * Webhook Event Handler Types
 */
export type WebhookHandlerResult = {
  success: boolean
  message?: string
}

/**
 * EasyPost Tracker Result Type
 */
export type TrackerResult = {
  id: string
  object: string
  mode: string
  tracking_code?: string
  status?: string
  carrier?: string
  tracking_details?: Array<{
    object: string
    message: string
    status: string
    datetime: string
    tracking_location?: {
      city?: string
      state?: string
      country?: string
      zip?: string
    }
  }>
  est_delivery_date?: string
  shipment_id?: string
}

/**
 * Handle EasyPost tracker updated event
 * Updates order tracking information, timestamps, and triggers notification emails
 */
export async function handleTrackerUpdated(
  tracker: TrackerResult
): Promise<WebhookHandlerResult> {
  const trackingCode = tracker.tracking_code

  if (!trackingCode) {
    console.warn('EasyPost tracker missing tracking_code:', tracker.id)
    return { success: true, message: 'Missing tracking_code' }
  }

  // Find the order by tracking code: a label bought through EasyPost, or else a tracking
  // number recorded by hand (Pirate Ship, a counter), whose tracker the order-tracking page
  // registers the first time it is viewed.
  const shippingLabel = await prisma.shippingLabel.findFirst({
    where: { trackingCode },
    include: { order: true },
  })
  const order =
    shippingLabel?.order ?? (await prisma.order.findFirst({ where: { trackingNumber: trackingCode } }))

  if (!order) {
    console.warn('No order found for EasyPost tracking code:', trackingCode)
    return { success: true, message: 'Order not found' }
  }
  const orderId = order.id

  // Update order with tracking information
  const trackingHistory = tracker.tracking_details || []
  const latestEvent = trackingHistory[0] // Most recent event

  const updates: {
    lastTrackingUpdate?: Date
    trackingHistory?: object
    shippedAt?: Date | null
    deliveredAt?: Date | null
    status?: OrderStatus
    fulfillmentStatus?: FulfillmentStatus
  } = {
    lastTrackingUpdate: new Date(),
    trackingHistory: trackingHistory as object,
  }

  let transition: FulfillmentTransition | null = null

  // Update shipped timestamp and move the order to SHIPPED on the first
  // in_transit event (idempotent via the shippedAt guard).
  if (tracker.status === 'in_transit' && !order.shippedAt) {
    transition = 'shipped'
  }

  // Update delivered timestamp and move the order to DELIVERED on the first
  // delivered event (idempotent via the deliveredAt guard).
  if (tracker.status === 'delivered' && !order.deliveredAt) {
    transition = 'delivered'
  }

  if (transition) {
    // The carrier's own event time is more accurate than "now", so it overrides the
    // timestamps the shared helper stamps.
    const carrierTime = latestEvent?.datetime ? new Date(latestEvent.datetime) : new Date()
    Object.assign(
      updates,
      buildFulfillmentUpdate({
        transition,
        current: order,
        now: carrierTime,
      })
    )
  }

  await prisma.order.update({
    where: { id: orderId },
    data: updates,
  })

  if (transition) {
    // in_transit means the carrier has the goods, so every item on the order has shipped.
    if (isDerivedTransition(transition)) {
      await fulfillEntireOrder(prisma, orderId, { via: 'webhook:easypost' })
    }

    await recordFulfillmentEvent({
      orderId,
      transition,
      current: order,
      eventPayload: { carrierStatus: tracker.status, via: 'webhook:easypost' },
    })
  }

  // Update ShippingLabel status
  if (shippingLabel) {
    await prisma.shippingLabel.update({
      where: { id: shippingLabel.id },
      data: { status: tracker.status || 'unknown' },
    })
  }

  console.log(
    'Order tracking updated via EasyPost webhook:',
    orderId,
    'Status:',
    tracker.status
  )

  // Trigger notification emails based on status
  if (tracker.status === 'in_transit' && updates.shippedAt) {
    sendOrderShippedEmail(orderId).catch((error) => {
      console.error('Failed to send shipped email', { orderId, error })
    })
  }

  if (tracker.status === 'delivered' && updates.deliveredAt) {
    sendOrderDeliveredEmail(orderId).catch((error) => {
      console.error('Failed to send delivered email', { orderId, error })
    })
  }

  return {
    success: true,
    message: `Tracking updated successfully for order ${orderId}`,
  }
}
