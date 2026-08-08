import { prisma } from '@/lib/prisma'
import { adjustInventory } from '@/lib/inventory-manager'
import { emitDomainEvent } from '@/lib/domain-events/emit'

import {
  derivePurchaseOrderStatus,
  projectLinesAfterReceipt,
  validateReceipt,
  type ReceiptLineInput,
  type ReceiptValidationError,
} from './receiving'

/**
 * Record a delivery against a purchase order and move the stock.
 *
 * This is the **only** path allowed to change `PurchaseOrderItem.quantityReceived`. It writes
 * the receipt, its line items, and the incremented rollup inside one transaction, so the
 * invariant that the rollup equals the sum of receipt items cannot be broken by a partial
 * failure. The equivalent invariant on the sales side was broken for a while by a helper that
 * moved the rollup without writing the rows; keeping one writer is how that is prevented here.
 *
 * Stock is moved *after* the transaction commits, through `adjustInventory`, for two reasons:
 * it is the same call the returns path uses, so receiving gets an inventory transaction and a
 * low-stock re-evaluation for free — meaning restocking now clears the low-stock notification
 * automatically — and it keeps a slow per-product alert check out of the transaction holding
 * the purchase-order rows.
 */

export type ReceiveResult =
  | { ok: true; receiptId: string; status: string; movedProducts: number }
  | { ok: false; error: ReceiptValidationError }

export async function receivePurchaseOrder(input: {
  purchaseOrderId: string
  lines: ReceiptLineInput[]
  reference?: string | null
  notes?: string | null
  receivedById?: string | null
}): Promise<ReceiveResult> {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: input.purchaseOrderId },
    select: {
      id: true,
      poNumber: true,
      status: true,
      items: {
        select: {
          id: true,
          productId: true,
          quantityOrdered: true,
          quantityReceived: true,
          unitCost: true,
        },
      },
    },
  })

  if (!purchaseOrder) {
    return {
      ok: false,
      error: { code: 'not_receivable', message: 'That purchase order does not exist.' },
    }
  }

  const validation = validateReceipt({
    status: purchaseOrder.status,
    lines: input.lines,
    orderLines: purchaseOrder.items,
  })

  if (!validation.ok) return { ok: false, error: validation.error }

  const { quantities } = validation
  const projected = projectLinesAfterReceipt(purchaseOrder.items, quantities)
  const nextStatus = derivePurchaseOrderStatus(purchaseOrder.status, projected)

  const receipt = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrderReceipt.create({
      data: {
        purchaseOrderId: purchaseOrder.id,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        receivedById: input.receivedById ?? null,
        items: {
          create: [...quantities].map(([purchaseOrderItemId, quantity]) => ({
            purchaseOrderItemId,
            quantity,
          })),
        },
      },
      select: { id: true },
    })

    // Increment, never set: two receipts landing close together must accumulate rather than
    // the second overwriting the first with a value read before it.
    for (const [purchaseOrderItemId, quantity] of quantities) {
      await tx.purchaseOrderItem.update({
        where: { id: purchaseOrderItemId },
        data: { quantityReceived: { increment: quantity } },
      })
    }

    if (nextStatus && nextStatus !== purchaseOrder.status) {
      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: nextStatus,
          receivedAt: nextStatus === 'RECEIVED' ? new Date() : null,
        },
      })
    }

    return created
  })

  // Stock movement, outside the transaction. A failure here leaves the receipt recorded and
  // the stock unmoved, which is visible and fixable; the reverse — stock moved with no
  // record of why — is not.
  let movedProducts = 0
  for (const line of purchaseOrder.items) {
    const quantity = quantities.get(line.id)
    if (!quantity) continue

    try {
      await adjustInventory({
        productId: line.productId,
        quantity,
        type: 'RESTOCK',
        reason: `Received on ${purchaseOrder.poNumber}`,
        purchaseOrderId: purchaseOrder.id,
        userId: input.receivedById ?? undefined,
      })
      movedProducts += 1
    } catch (error) {
      console.error('[purchasing] Could not move stock for received line', {
        purchaseOrderId: purchaseOrder.id,
        purchaseOrderItemId: line.id,
        error,
      })
    }
  }

  await emitDomainEvent({
    type: 'inventory.adjusted',
    entityType: 'product',
    entityId: purchaseOrder.id,
    actorUserId: input.receivedById ?? null,
    payload: {
      poNumber: purchaseOrder.poNumber,
      receiptId: receipt.id,
      status: nextStatus ?? purchaseOrder.status,
      lines: [...quantities].map(([purchaseOrderItemId, quantity]) => ({
        purchaseOrderItemId,
        quantity,
      })),
    },
  })

  return {
    ok: true,
    receiptId: receipt.id,
    status: nextStatus ?? purchaseOrder.status,
    movedProducts,
  }
}
