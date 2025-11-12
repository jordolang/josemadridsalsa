import prisma from '@/lib/prisma';
import { getEverShopClient } from '@/lib/evershop/client';

const hasEverShopConfig = () =>
  Boolean(process.env.EVERSHOP_API_URL && process.env.EVERSHOP_API_KEY);

export async function syncOrderToEverShop(orderId: string) {
  if (!hasEverShopConfig()) {
    return;
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
  });

  if (!order) {
    console.warn(`[EverShop] Order ${orderId} not found for sync`);
    return;
  }

  try {
    const client = getEverShopClient();
    const result = await client.createOrder(order);

    if (!result.success) {
      console.error(`[EverShop] Failed to sync order ${order.orderNumber}:`, result.error);
      return;
    }

    if (result.order) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          adminNotes: [
            order.adminNotes,
            `EverShop Order ID: ${result.order.orderId}, UUID: ${result.order.uuid}`,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });
    }
  } catch (error) {
    console.error(`[EverShop] Error syncing order ${order.orderNumber}:`, error);
  }
}

export function queueEverShopSync(orderId: string) {
  void syncOrderToEverShop(orderId);
}
