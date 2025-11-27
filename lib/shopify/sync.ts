import prisma from '@/lib/prisma'
import { getShopifyClient } from '@/lib/shopify/client'

const hasShopifyConfig = () =>
  Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_API_TOKEN)

export async function syncOrderToShopify(orderId: string) {
  if (!hasShopifyConfig()) {
    return
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      shippingAddress: true,
      billingAddress: true,
      user: true,
    },
  })

  if (!order) {
    console.warn(`[Shopify] Order ${orderId} not found for sync`)
    return
  }

  try {
    const client = getShopifyClient()
    const result = await client.createOrder(order)

    if (!result.success || !result.order) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          shopifySyncError: result.error || 'Unknown Shopify error',
        },
      })
      console.error(`[Shopify] Failed to sync order ${order.orderNumber}:`, result.error)
      return
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        shopifyOrderId: String(result.order.id),
        shopifyOrderName: result.order.name,
        shopifyFinancialStatus: result.order.financial_status || undefined,
        shopifyFulfillmentStatus: result.order.fulfillment_status || undefined,
        shopifySyncedAt: new Date(),
        shopifySyncError: null,
        adminNotes: [
          order.adminNotes,
          `Shopify Order ${result.order.name} (${result.order.id}) synced ${new Date().toISOString()}`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    })
  } catch (error) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        shopifySyncError: error instanceof Error ? error.message : 'Unknown Shopify error',
      },
    })
    console.error(`[Shopify] Error syncing order ${order.orderNumber}:`, error)
  }
}

export function queueShopifySync(orderId: string) {
  void syncOrderToShopify(orderId)
}
