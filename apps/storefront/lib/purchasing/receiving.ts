import type { PurchaseOrderStatus } from '@prisma/client'

/**
 * Receiving a purchase order.
 *
 * This is order fulfillment pointed the other way, and it carries the same invariant:
 * `PurchaseOrderItem.quantityReceived` is a cached rollup that must always equal the sum of
 * that line's receipt items. The fulfillment version of this was broken for a while by a
 * path that advanced the rollup without writing the corresponding rows — a bug no unit test
 * could see, because the two halves were only inconsistent in the database. So the rule here
 * is stated once and enforced in one place: **quantities are incremented by the receiving
 * path, which writes the receipt rows in the same transaction, and set by nothing else.**
 *
 * The other borrowed lesson is the status split. `PARTIALLY_RECEIVED` and `RECEIVED` are
 * derived from quantities and computed here; `DRAFT`, `SUBMITTED` and `CANCELLED` are
 * lifecycle states a person chooses. Deriving the first two means they cannot drift from the
 * line items the way an independently-stamped enum does.
 */

export interface ReceivableLine {
  id: string
  quantityOrdered: number
  quantityReceived: number
}

export interface ReceiptLineInput {
  purchaseOrderItemId: string
  quantity: number
}

/** How much of a line is still outstanding. Never negative. */
export function remainingToReceive(line: ReceivableLine): number {
  return Math.max(0, line.quantityOrdered - line.quantityReceived)
}

/** Statuses a purchase order can still be received against. */
export function canReceive(status: PurchaseOrderStatus): boolean {
  return status === 'SUBMITTED' || status === 'PARTIALLY_RECEIVED'
}

/** Nothing further will happen to these on their own. */
export function isClosedPurchaseOrder(status: PurchaseOrderStatus): boolean {
  return status === 'RECEIVED' || status === 'CANCELLED'
}

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PARTIALLY_RECEIVED: 'Partially received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

export type ReceiptProgress = 'NONE' | 'PARTIAL' | 'COMPLETE'

/**
 * The sole authority for how far along a purchase order is.
 *
 * A PO with no lines reports NONE rather than COMPLETE — "every line is received" is
 * vacuously true of no lines, and calling an empty order fully received would let a draft
 * with nothing on it close itself.
 */
export function deriveReceiptProgress(lines: ReceivableLine[]): ReceiptProgress {
  if (lines.length === 0) return 'NONE'

  const received = lines.reduce((sum, line) => sum + line.quantityReceived, 0)
  if (received === 0) return 'NONE'

  const outstanding = lines.reduce((sum, line) => sum + remainingToReceive(line), 0)
  return outstanding === 0 ? 'COMPLETE' : 'PARTIAL'
}

/**
 * The status a purchase order should hold given its lines.
 *
 * Returns null for orders whose status is not derived — a cancelled or draft PO keeps what
 * it was given, so a late receipt cannot resurrect it. That mirrors `isTerminalOrderStatus`
 * on the sales side.
 */
export function derivePurchaseOrderStatus(
  current: PurchaseOrderStatus,
  lines: ReceivableLine[]
): PurchaseOrderStatus | null {
  if (!canReceive(current) && current !== 'RECEIVED') return null

  switch (deriveReceiptProgress(lines)) {
    case 'NONE':
      return 'SUBMITTED'
    case 'PARTIAL':
      return 'PARTIALLY_RECEIVED'
    case 'COMPLETE':
      return 'RECEIVED'
  }
}

export type ReceiptValidationError =
  | { code: 'not_receivable'; message: string }
  | { code: 'empty'; message: string }
  | { code: 'unknown_line'; message: string; purchaseOrderItemId: string }
  | { code: 'duplicate_line'; message: string; purchaseOrderItemId: string }
  | { code: 'over_receipt'; message: string; purchaseOrderItemId: string }

export type ReceiptValidation =
  | { ok: true; quantities: Map<string, number> }
  | { ok: false; error: ReceiptValidationError }

/**
 * Check a receipt before anything is written.
 *
 * Over-receiving is refused rather than clamped. Silently accepting 12 against a line with 10
 * outstanding would push `quantityReceived` past `quantityOrdered` and corrupt every count
 * derived from it — and it usually means the wrong line was picked, which is worth stopping
 * for. A genuine over-delivery is a change to the order, made deliberately.
 */
export function validateReceipt(input: {
  status: PurchaseOrderStatus
  lines: ReceiptLineInput[]
  orderLines: ReceivableLine[]
}): ReceiptValidation {
  if (!canReceive(input.status)) {
    return {
      ok: false,
      error: {
        code: 'not_receivable',
        message: `A ${input.status.toLowerCase().replace('_', ' ')} purchase order cannot be received against.`,
      },
    }
  }

  const positive = input.lines.filter((line) => line.quantity > 0)
  if (positive.length === 0) {
    return { ok: false, error: { code: 'empty', message: 'Nothing was marked as received.' } }
  }

  const byId = new Map(input.orderLines.map((line) => [line.id, line]))
  const quantities = new Map<string, number>()

  for (const line of positive) {
    const orderLine = byId.get(line.purchaseOrderItemId)
    if (!orderLine) {
      return {
        ok: false,
        error: {
          code: 'unknown_line',
          message: 'That line is not on this purchase order.',
          purchaseOrderItemId: line.purchaseOrderItemId,
        },
      }
    }

    if (quantities.has(line.purchaseOrderItemId)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_line',
          message: 'The same line was submitted twice in one receipt.',
          purchaseOrderItemId: line.purchaseOrderItemId,
        },
      }
    }

    const remaining = remainingToReceive(orderLine)
    if (line.quantity > remaining) {
      return {
        ok: false,
        error: {
          code: 'over_receipt',
          message:
            remaining === 0
              ? 'That line has already been received in full.'
              : `Only ${remaining} of that line ${remaining === 1 ? 'is' : 'are'} still outstanding.`,
          purchaseOrderItemId: line.purchaseOrderItemId,
        },
      }
    }

    quantities.set(line.purchaseOrderItemId, line.quantity)
  }

  return { ok: true, quantities }
}

/**
 * Apply validated receipt quantities to the lines, returning what they become.
 *
 * Used to derive the resulting status before writing, so the PO's status and its line totals
 * are decided from the same numbers rather than computed twice from different reads.
 */
export function projectLinesAfterReceipt(
  lines: ReceivableLine[],
  quantities: Map<string, number>
): ReceivableLine[] {
  return lines.map((line) => {
    const received = quantities.get(line.id)
    return received
      ? { ...line, quantityReceived: line.quantityReceived + received }
      : line
  })
}

/** Total value of a purchase order's lines, in cents, excluding shipping. */
export function purchaseOrderSubtotalCents(
  lines: Array<{ quantityOrdered: number; unitCost: number }>
): number {
  return lines.reduce(
    (sum, line) => sum + Math.round(line.unitCost * 100) * line.quantityOrdered,
    0
  )
}

/** Sequential-ish PO reference. Mirrors the order-number format staff already read. */
export function generatePoNumber(now: Date): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = Math.floor(Math.random() * 9000 + 1000)
  return `PO-${datePart}-${randomPart}`
}
