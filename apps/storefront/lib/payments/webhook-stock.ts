/**
 * Stock deduction for a payment webhook that finalizes an order.
 *
 * The capture routes deduct stock when the customer returns to the site; the webhook is
 * the fallback for when they don't. Both go through the per-item ORDER_COMPLETION guard,
 * so whichever finalizes the order second deducts nothing.
 *
 * Unlike the capture routes, a webhook arrives after the money is taken and is retried
 * until it succeeds. A missing reservation (released by expiry while the customer sat on
 * the provider's page) must not roll back marking the order paid — that would leave a
 * captured payment on an unpaid order, re-failing on every retry. Those items are skipped
 * here and returned so the caller can tell staff to adjust stock by hand.
 */
import type { Prisma } from '@prisma/client'
import { checkAndUpdateAlerts, deductReservedInventoryOnceInTx } from '@/lib/inventory-manager'
import { notifyOperators, severityFor } from '@/lib/notifications/dispatch'

interface WebhookOrder {
  id: string
  orderNumber: string
  items: Array<{ productId: string; quantity: number }>
}

export interface WebhookStockResult {
  deducted: Array<{ productId: string; newInventory: number; lowStockThreshold: number }>
  failed: Array<{ productId: string; quantity: number; reason: string }>
}

/** Run inside the webhook's Serializable transaction that marks the order paid. */
export async function deductWebhookOrderStockInTx(
  tx: Prisma.TransactionClient,
  order: WebhookOrder,
  provider: string
): Promise<WebhookStockResult> {
  const result: WebhookStockResult = { deducted: [], failed: [] }

  for (const item of order.items) {
    try {
      // The guard and validation run before any write for the item, so a refusal here
      // leaves the transaction usable for the next item and the paid-status update.
      const deduction = await deductReservedInventoryOnceInTx(
        {
          productId: item.productId,
          quantity: item.quantity,
          orderId: order.id,
          notes: `${provider} webhook deduction for order ${order.orderNumber}`,
        },
        tx
      )
      if (deduction) {
        result.deducted.push({
          productId: deduction.product.id,
          newInventory: deduction.newInventory,
          lowStockThreshold: deduction.product.lowStockThreshold,
        })
      }
    } catch (error) {
      result.failed.push({
        productId: item.productId,
        quantity: item.quantity,
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return result
}

/** After the transaction commits: low-stock alerts, and a staff alert for any skipped item. */
export async function settleWebhookStock(order: WebhookOrder, provider: string, result: WebhookStockResult) {
  for (const d of result.deducted) {
    checkAndUpdateAlerts(d.productId, d.newInventory, d.lowStockThreshold).catch((err) =>
      console.error(`Alert sync failed for product ${d.productId}:`, err)
    )
  }

  if (result.failed.length === 0) return

  console.error(`[${provider} webhook] Stock not deducted for order ${order.orderNumber}:`, result.failed)
  await notifyOperators({
    type: 'SYSTEM',
    severity: severityFor('SYSTEM'),
    title: `Adjust stock for order ${order.orderNumber}`,
    message:
      `${provider} confirmed payment after the stock reservation was released, so ` +
      `${result.failed.length} item(s) were not deducted automatically: ` +
      result.failed.map((f) => `${f.quantity} × ${f.productId} (${f.reason})`).join('; '),
    entityType: 'order',
    entityId: order.id,
    link: `/admin/orders/${order.id}`,
    dedupeKey: `webhook-stock:${order.id}`,
  })
}
