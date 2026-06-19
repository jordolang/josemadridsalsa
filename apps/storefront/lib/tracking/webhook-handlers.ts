import prisma from '@/lib/prisma'

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
type TrackerResult = {
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

  // Find order by tracking code via ShippingLabel
  const shippingLabel = await prisma.shippingLabel.findFirst({
    where: { trackingCode },
    include: { order: true },
  })

  if (!shippingLabel) {
    console.warn('No order found for EasyPost tracking code:', trackingCode)
    return { success: true, message: 'Order not found' }
  }

  // Update order with tracking information
  const trackingHistory = tracker.tracking_details || []
  const latestEvent = trackingHistory[0] // Most recent event

  const updates: {
    lastTrackingUpdate?: Date
    trackingHistory?: object
    shippedAt?: Date | null
    deliveredAt?: Date | null
  } = {
    lastTrackingUpdate: new Date(),
    trackingHistory: trackingHistory as object,
  }

  // Update shipped timestamp on first in_transit event (idempotency)
  if (tracker.status === 'in_transit' && !shippingLabel.order.shippedAt) {
    updates.shippedAt = latestEvent?.datetime
      ? new Date(latestEvent.datetime)
      : new Date()
  }

  // Update delivered timestamp on delivered event (idempotency)
  if (tracker.status === 'delivered' && !shippingLabel.order.deliveredAt) {
    updates.deliveredAt = latestEvent?.datetime
      ? new Date(latestEvent.datetime)
      : new Date()
  }

  await prisma.order.update({
    where: { id: shippingLabel.orderId },
    data: updates,
  })

  // Update ShippingLabel status
  await prisma.shippingLabel.update({
    where: { id: shippingLabel.id },
    data: { status: tracker.status || 'unknown' },
  })

  console.log(
    'Order tracking updated via EasyPost webhook:',
    shippingLabel.orderId,
    'Status:',
    tracker.status
  )

  // TODO: Trigger notification emails based on status
  // This will be integrated in phase-4 (email notifications)
  // if (tracker.status === 'in_transit' && updates.shippedAt) {
  //   sendOrderShippedEmail(shippingLabel.orderId).catch((error) => {
  //     console.error('Failed to send shipped email', { orderId: shippingLabel.orderId, error })
  //   })
  // }
  //
  // if (tracker.status === 'delivered' && updates.deliveredAt) {
  //   sendOrderDeliveredEmail(shippingLabel.orderId).catch((error) => {
  //     console.error('Failed to send delivered email', { orderId: shippingLabel.orderId, error })
  //   })
  // }

  return {
    success: true,
    message: `Tracking updated successfully for order ${shippingLabel.orderId}`,
  }
}
