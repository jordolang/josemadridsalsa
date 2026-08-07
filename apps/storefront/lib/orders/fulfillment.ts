import type { FulfillmentStatus, OrderStatus, Prisma } from '@prisma/client'

import { emitDomainEvent } from '@/lib/domain-events/emit'
import type { DomainEventType } from '@/lib/domain-events/types'

/**
 * Fulfillment state lives on `Order.fulfillmentStatus`, separate from `Order.status`
 * (commercial lifecycle) and `Order.paymentStatus` (money). Because the two former
 * fields are correlated, every writer must set them together or they drift within a day
 * of deploy — so nothing outside this module should assign `fulfillmentStatus` directly.
 * Callers build their update through `buildFulfillmentUpdate` instead.
 */

export interface OrderItemFulfillment {
  quantity: number
  quantityFulfilled: number
}

/**
 * Derive fulfillment status from item quantities. This is the single source of truth —
 * `Order.fulfillmentStatus` is a denormalisation of it, kept for cheap filtering.
 */
export function deriveFulfillmentStatus(
  items: OrderItemFulfillment[]
): Extract<FulfillmentStatus, 'UNFULFILLED' | 'PARTIALLY_FULFILLED' | 'FULFILLED'> {
  if (items.length === 0) return 'UNFULFILLED'

  const totalOrdered = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalFulfilled = items.reduce(
    // Guard against a bad write leaving quantityFulfilled above quantity; an over-count
    // must not make a partially shipped order read as fully shipped.
    (sum, item) => sum + Math.min(item.quantityFulfilled, item.quantity),
    0
  )

  if (totalFulfilled <= 0) return 'UNFULFILLED'
  if (totalFulfilled >= totalOrdered) return 'FULFILLED'
  return 'PARTIALLY_FULFILLED'
}

/** Fulfillment states that mean nothing more needs to ship. */
export const SETTLED_FULFILLMENT_STATUSES: FulfillmentStatus[] = [
  'FULFILLED',
  'DELIVERED',
  'RETURNED',
]

export function isAwaitingFulfillment(status: FulfillmentStatus): boolean {
  return !SETTLED_FULFILLMENT_STATUSES.includes(status)
}

export type FulfillmentTransition =
  | 'shipped'
  | 'partially_shipped'
  | 'delivered'
  | 'returned'
  | 'unfulfilled'

const TRANSITION_TO_STATUS: Record<FulfillmentTransition, FulfillmentStatus> = {
  shipped: 'FULFILLED',
  partially_shipped: 'PARTIALLY_FULFILLED',
  delivered: 'DELIVERED',
  returned: 'RETURNED',
  unfulfilled: 'UNFULFILLED',
}

const TRANSITION_TO_EVENT: Record<FulfillmentTransition, DomainEventType | null> = {
  shipped: 'order.fulfilled',
  partially_shipped: 'order.partially_fulfilled',
  delivered: 'order.delivered',
  returned: 'order.returned',
  unfulfilled: null,
}

export interface BuildFulfillmentUpdateOptions {
  transition: FulfillmentTransition
  /** The order's current values, so timestamps are only stamped once. */
  current: {
    status: OrderStatus
    shippedAt?: Date | null
    deliveredAt?: Date | null
  }
  /**
   * Whether to advance `Order.status` alongside fulfillment. Defaults to true.
   * Set false when the commercial status is being set by the caller for another
   * reason (a refund marking the order REFUNDED, say) and must not be overwritten.
   */
  syncOrderStatus?: boolean
  now?: Date
}

/**
 * Build the `Order` update for a fulfillment transition: fulfillment status, the
 * matching commercial status, and the shipped/delivered timestamps — as one object, so
 * the five routes that ship orders cannot each get a different subset right.
 */
export function buildFulfillmentUpdate(
  options: BuildFulfillmentUpdateOptions
): Prisma.OrderUpdateInput {
  const { transition, current, syncOrderStatus = true, now = new Date() } = options

  const update: Prisma.OrderUpdateInput = {
    fulfillmentStatus: TRANSITION_TO_STATUS[transition],
  }

  if (transition === 'shipped' || transition === 'partially_shipped') {
    if (!current.shippedAt) update.shippedAt = now
    // A partially shipped order is not SHIPPED commercially — it is still being worked.
    if (syncOrderStatus && transition === 'shipped' && !isTerminalOrderStatus(current.status)) {
      update.status = 'SHIPPED'
    }
    if (syncOrderStatus && transition === 'partially_shipped' && current.status === 'CONFIRMED') {
      update.status = 'PROCESSING'
    }
  }

  if (transition === 'delivered') {
    if (!current.shippedAt) update.shippedAt = now
    if (!current.deliveredAt) update.deliveredAt = now
    if (syncOrderStatus && !isTerminalOrderStatus(current.status)) {
      update.status = 'DELIVERED'
    }
  }

  return update
}

/**
 * Statuses that fulfillment must not overwrite — once an order is cancelled or refunded,
 * a late tracking webhook should record the delivery without resurrecting the order.
 */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === 'CANCELLED' || status === 'REFUNDED'
}

/**
 * The fulfillment status a transition lands on. Exported for `updateMany` callers, which
 * cannot use `buildFulfillmentUpdate` (it returns per-row values) but must not hand-roll
 * a second copy of the mapping.
 */
export function fulfillmentStatusFor(transition: FulfillmentTransition): FulfillmentStatus {
  return TRANSITION_TO_STATUS[transition]
}

/**
 * Map an admin-chosen `OrderStatus` to the fulfillment transition it implies, so the
 * status-setting routes stay a one-line change rather than each re-deriving the rules.
 * Returns null when the chosen status says nothing about fulfillment.
 */
export function transitionForOrderStatus(
  status: OrderStatus,
  current: { shippedAt?: Date | null; deliveredAt?: Date | null }
): FulfillmentTransition | null {
  switch (status) {
    case 'SHIPPED':
      return 'shipped'
    case 'DELIVERED':
      return 'delivered'
    case 'REFUNDED':
      // Goods that never left do not come back. Only a shipped order becomes RETURNED;
      // refunding an unshipped order leaves it UNFULFILLED so it drops out of the queue
      // on its cancelled/refunded commercial status instead.
      return current.shippedAt || current.deliveredAt ? 'returned' : null
    default:
      return null
  }
}

export interface RecordFulfillmentTransitionOptions extends BuildFulfillmentUpdateOptions {
  orderId: string
  actorUserId?: string | null
  eventPayload?: Record<string, unknown>
}

/**
 * Emit the domain event for a fulfillment transition. Kept separate from
 * `buildFulfillmentUpdate` so callers can run the DB write inside their own transaction
 * and emit afterwards.
 */
export async function recordFulfillmentEvent(
  options: RecordFulfillmentTransitionOptions
): Promise<void> {
  const eventType = TRANSITION_TO_EVENT[options.transition]
  if (!eventType) return

  await emitDomainEvent({
    type: eventType,
    entityType: 'order',
    entityId: options.orderId,
    actorUserId: options.actorUserId ?? null,
    payload: options.eventPayload ?? null,
  })
}

/** Human labels for admin filters and badges. */
export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  UNFULFILLED: 'Unfulfilled',
  PARTIALLY_FULFILLED: 'Partially fulfilled',
  FULFILLED: 'Fulfilled',
  DELIVERED: 'Delivered',
  RETURNED: 'Returned',
}
