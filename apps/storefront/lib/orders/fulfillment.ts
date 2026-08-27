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

/**
 * Which fulfillment states are *derived* from item quantities versus set directly.
 *
 * `UNFULFILLED`/`PARTIALLY_FULFILLED`/`FULFILLED` describe how much of the order has
 * shipped, so once items carry `quantityFulfilled` they are the only honest source —
 * `deriveFulfillmentStatus` computes them and nothing else may assert them. `DELIVERED` and
 * `RETURNED` say what happened *after* everything shipped and cannot be inferred from
 * quantities, so they remain order-level overlays.
 *
 * A transition mapping to `null` therefore means "fulfill the items, then derive".
 */
const TRANSITION_TO_STATUS: Record<FulfillmentTransition, FulfillmentStatus | null> = {
  shipped: null,
  partially_shipped: null,
  delivered: 'DELIVERED',
  returned: 'RETURNED',
  unfulfilled: 'UNFULFILLED',
}

/** Transitions whose resulting status comes from item quantities rather than the map. */
export function isDerivedTransition(transition: FulfillmentTransition): boolean {
  return TRANSITION_TO_STATUS[transition] === null
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

  const overlay = TRANSITION_TO_STATUS[transition]

  // For shipped/partially_shipped the enum is derived from item quantities by the caller
  // (see fulfillOrderItems), so this deliberately does not assert it.
  const update: Prisma.OrderUpdateInput = overlay ? { fulfillmentStatus: overlay } : {}

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
 * The overlay status a transition lands on, or null when it must be derived from items.
 * Exported for `updateMany` callers, which cannot use `buildFulfillmentUpdate` (it returns
 * per-row values) but must not hand-roll a second copy of the mapping.
 */
export function fulfillmentStatusFor(
  transition: FulfillmentTransition
): FulfillmentStatus | null {
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

/** Minimal client surface needed to write fulfillment; satisfied by prisma or a tx client. */
export type FulfillmentWriteClient = Pick<
  Prisma.TransactionClient,
  'order' | 'orderItem' | 'fulfillment'
>

/**
 * Mark specific quantities of an order's items as shipped and re-derive the order's
 * fulfillment status from the result.
 *
 * Quantities are **incremented**, never set, so successive partial shipments accumulate
 * rather than overwriting each other. The caller is responsible for having validated that
 * each quantity fits in the item's remaining balance — `remainingToFulfill` exists for that.
 *
 * Returns the derived status so callers can emit the matching domain event.
 */
export async function fulfillOrderItems(
  client: FulfillmentWriteClient,
  orderId: string,
  quantitiesByItemId: Map<string, number>
): Promise<FulfillmentStatus> {
  for (const [orderItemId, quantity] of quantitiesByItemId) {
    if (quantity <= 0) continue
    await client.orderItem.update({
      where: { id: orderItemId },
      data: { quantityFulfilled: { increment: quantity } },
    })
  }

  const items = await client.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, quantityFulfilled: true },
  })

  const status = deriveFulfillmentStatus(items)
  await client.order.update({ where: { id: orderId }, data: { fulfillmentStatus: status } })

  return status
}

/**
 * Treat an order as entirely shipped: bring every item up to its ordered quantity and
 * derive. This is what an order-level "mark shipped" signal means — the admin status
 * dropdown, bulk status, EasyPost tracking — so that the order enum
 * and the item quantities cannot disagree about how much went out.
 *
 * A `Fulfillment` row is created for whatever was outstanding, because the invariant
 * downstream code (returns especially) relies on is that an item's `quantityFulfilled`
 * always equals the sum of the `FulfillmentItem` rows covering it. Incrementing the counter
 * without recording the shipment would break that silently.
 */
export async function fulfillEntireOrder(
  client: FulfillmentWriteClient,
  orderId: string,
  options: { via?: string; createdById?: string | null } = {}
): Promise<FulfillmentStatus> {
  const items = await client.orderItem.findMany({
    where: { orderId },
    select: { id: true, quantity: true, quantityFulfilled: true },
  })

  const outstanding = new Map(
    items
      .filter((item) => item.quantityFulfilled < item.quantity)
      .map((item) => [item.id, item.quantity - item.quantityFulfilled])
  )

  // Nothing left to ship — the order is already fully covered, so re-deriving is enough
  // and no empty shipment record is created.
  if (outstanding.size === 0) {
    const status = deriveFulfillmentStatus(items)
    await client.order.update({ where: { id: orderId }, data: { fulfillmentStatus: status } })
    return status
  }

  await client.fulfillment.create({
    data: {
      orderId,
      status: 'FULFILLED',
      shippedAt: new Date(),
      createdById: options.createdById ?? null,
      notes: options.via ? `Recorded automatically via ${options.via}` : null,
      items: {
        create: [...outstanding].map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      },
    },
  })

  return fulfillOrderItems(client, orderId, outstanding)
}

/** How many units of an item are still awaiting shipment. Never negative. */
export function remainingToFulfill(item: OrderItemFulfillment): number {
  return Math.max(0, item.quantity - item.quantityFulfilled)
}

export interface FulfillmentRequestLine {
  orderItemId: string
  quantity: number
}

export type FulfillmentValidationError =
  | { code: 'EMPTY'; message: string }
  | { code: 'UNKNOWN_ITEM'; message: string; orderItemId: string }
  | { code: 'EXCEEDS_REMAINING'; message: string; orderItemId: string; remaining: number }

/**
 * Check a requested fulfillment against what the order actually has left to ship.
 *
 * Returns the validated quantities keyed by item id, or the first problem found. Shipping
 * more units than were ordered would make `quantityFulfilled` exceed `quantity` and quietly
 * corrupt every downstream count, so this is enforced rather than clamped.
 */
export function validateFulfillmentRequest(
  lines: FulfillmentRequestLine[],
  orderItems: (OrderItemFulfillment & { id: string })[]
): { ok: true; quantities: Map<string, number> } | { ok: false; error: FulfillmentValidationError } {
  const requested = new Map<string, number>()

  for (const line of lines) {
    if (line.quantity <= 0) continue
    requested.set(line.orderItemId, (requested.get(line.orderItemId) ?? 0) + line.quantity)
  }

  if (requested.size === 0) {
    return { ok: false, error: { code: 'EMPTY', message: 'Select at least one item to fulfill' } }
  }

  const byId = new Map(orderItems.map((item) => [item.id, item]))

  for (const [orderItemId, quantity] of requested) {
    const item = byId.get(orderItemId)
    if (!item) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_ITEM',
          message: 'That item is not part of this order',
          orderItemId,
        },
      }
    }

    const remaining = remainingToFulfill(item)
    if (quantity > remaining) {
      return {
        ok: false,
        error: {
          code: 'EXCEEDS_REMAINING',
          message:
            remaining === 0
              ? 'That item has already been fully fulfilled'
              : `Only ${remaining} of that item remain to fulfill`,
          orderItemId,
          remaining,
        },
      }
    }
  }

  return { ok: true, quantities: requested }
}
