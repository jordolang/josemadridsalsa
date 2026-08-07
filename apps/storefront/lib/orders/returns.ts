import type { ReturnItemCondition, ReturnStatus } from '@prisma/client'

/**
 * Return (RMA) domain rules.
 *
 * Two things anchor this module. First, only what actually shipped can come back — the
 * returnable balance is `quantityFulfilled` minus whatever earlier returns already claimed,
 * never the ordered quantity. Second, restocking is driven by the condition recorded at
 * inspection, so units that came back broken are visible as a loss instead of silently
 * re-entering sellable stock.
 */

/** How many days after fulfillment a return may be requested. */
export const RETURN_WINDOW_DAYS = 30

/** Statuses after which nothing further happens. */
export const TERMINAL_RETURN_STATUSES: ReturnStatus[] = ['REJECTED', 'COMPLETED', 'CANCELLED']

/**
 * Allowed moves. Approval and receipt are separate steps because goods physically arriving
 * is a distinct event from agreeing to take them back, and the refund only follows once
 * they have been inspected.
 */
const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['COMPLETED'],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
}

export function canTransitionReturn(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_TRANSITIONS[from].includes(to)
}

export function nextReturnStatuses(from: ReturnStatus): ReturnStatus[] {
  return RETURN_TRANSITIONS[from]
}

export function isTerminalReturnStatus(status: ReturnStatus): boolean {
  return TERMINAL_RETURN_STATUSES.includes(status)
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECEIVED: 'Received',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export interface ReturnableOrderItem {
  id: string
  quantity: number
  quantityFulfilled: number
  unitPrice: number
  /** Units already claimed by other return requests that have not been rejected/cancelled. */
  quantityReturned?: number
}

/**
 * How many units of a line may still be returned. Bounded by what shipped, not what was
 * ordered — an unfulfilled line has nothing to send back.
 */
export function returnableQuantity(item: ReturnableOrderItem): number {
  return Math.max(0, item.quantityFulfilled - (item.quantityReturned ?? 0))
}

export interface ReturnRequestLine {
  orderItemId: string
  quantity: number
}

export type ReturnValidationError =
  | { code: 'EMPTY'; message: string }
  | { code: 'UNKNOWN_ITEM'; message: string; orderItemId: string }
  | { code: 'EXCEEDS_RETURNABLE'; message: string; orderItemId: string; returnable: number }
  | { code: 'WINDOW_EXPIRED'; message: string }
  | { code: 'NOT_FULFILLED'; message: string }

export interface ValidateReturnOptions {
  lines: ReturnRequestLine[]
  orderItems: ReturnableOrderItem[]
  /** When the order shipped; returns are measured from then, not from order date. */
  fulfilledAt?: Date | null
  now?: Date
  /** Staff can accept a return outside the window; customer-initiated requests cannot. */
  ignoreWindow?: boolean
}

export function validateReturnRequest(
  options: ValidateReturnOptions
): { ok: true; quantities: Map<string, number> } | { ok: false; error: ReturnValidationError } {
  const { lines, orderItems, fulfilledAt, now = new Date(), ignoreWindow = false } = options

  if (!fulfilledAt) {
    return {
      ok: false,
      error: {
        code: 'NOT_FULFILLED',
        message: 'Nothing has shipped on this order yet, so there is nothing to return',
      },
    }
  }

  if (!ignoreWindow && !isWithinReturnWindow(fulfilledAt, now)) {
    return {
      ok: false,
      error: {
        code: 'WINDOW_EXPIRED',
        message: `Returns are accepted within ${RETURN_WINDOW_DAYS} days of shipping`,
      },
    }
  }

  const requested = new Map<string, number>()
  for (const line of lines) {
    if (line.quantity <= 0) continue
    requested.set(line.orderItemId, (requested.get(line.orderItemId) ?? 0) + line.quantity)
  }

  if (requested.size === 0) {
    return { ok: false, error: { code: 'EMPTY', message: 'Select at least one item to return' } }
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

    const returnable = returnableQuantity(item)
    if (quantity > returnable) {
      return {
        ok: false,
        error: {
          code: 'EXCEEDS_RETURNABLE',
          message:
            returnable === 0
              ? 'That item has not shipped, or has already been returned in full'
              : `Only ${returnable} of that item can be returned`,
          orderItemId,
          returnable,
        },
      }
    }
  }

  return { ok: true, quantities: requested }
}

export function isWithinReturnWindow(fulfilledAt: Date, now: Date = new Date()): boolean {
  const elapsedDays = (now.getTime() - fulfilledAt.getTime()) / (24 * 60 * 60 * 1000)
  return elapsedDays <= RETURN_WINDOW_DAYS
}

/**
 * What the customer gets back: the value of the returned units, less any restocking fee.
 *
 * Works in cents to avoid float drift, and never returns a negative — a fee larger than the
 * goods refunds nothing rather than charging the customer.
 */
export function computeReturnRefundCents(
  quantities: Map<string, number>,
  orderItems: ReturnableOrderItem[],
  restockingFee = 0
): number {
  const byId = new Map(orderItems.map((item) => [item.id, item]))

  const goodsCents = [...quantities].reduce((sum, [orderItemId, quantity]) => {
    const item = byId.get(orderItemId)
    if (!item) return sum
    return sum + Math.round(item.unitPrice * 100) * quantity
  }, 0)

  return Math.max(0, goodsCents - Math.round(restockingFee * 100))
}

/**
 * Which returned units go back into sellable stock.
 *
 * Only `RESELLABLE` units are restocked. `DAMAGED` units are still recorded against
 * inventory so the write-off is visible, and `DISCARDED` units are not recorded at all
 * because they never re-entered the building's stock in any form.
 */
export interface RestockDecision {
  orderItemId: string
  quantity: number
  transactionType: 'RETURN' | 'DAMAGED'
  addsToSellableStock: boolean
}

export function planRestock(
  items: { orderItemId: string; quantity: number; condition: ReturnItemCondition | null; restocked: boolean }[]
): RestockDecision[] {
  return items
    // Already-restocked lines are skipped so re-running completion cannot double-count.
    .filter((item) => !item.restocked && item.quantity > 0 && item.condition !== null)
    .filter((item) => item.condition !== 'DISCARDED')
    .map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      transactionType: item.condition === 'RESELLABLE' ? ('RETURN' as const) : ('DAMAGED' as const),
      addsToSellableStock: item.condition === 'RESELLABLE',
    }))
}

/** RMA numbers are human-quotable on a phone call, so they are short and unambiguous. */
export function generateRmaNumber(now: Date, random: () => number = Math.random): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const suffix = Math.floor(random() * 9000 + 1000)
  return `RMA-${datePart}-${suffix}`
}
